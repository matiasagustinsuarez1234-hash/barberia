import cron from 'node-cron';
import Reservation from '../models/Reservation.js';
import ReminderLog from '../models/ReminderLog.js';
import { sendPushToClient } from './pushManager.js';
import { sendReminderEmail } from './emailManager.js';

export async function runReminders() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Recordatorios] Buscando turnos pendientes para ${today}...`);

  const reservations = await Reservation.find({ date: today, status: 'pending' }).populate([
    { path: 'client', select: 'name phone email' },
    { path: 'barber', select: 'name' },
    { path: 'activity', select: 'title' },
    { path: 'shop', select: 'name slug' },
  ]);

  if (reservations.length === 0) {
    console.log('[Recordatorios] Sin turnos pendientes para hoy.');
    await ReminderLog.create({ date: today, sent: 0, errors: 0, skipped: 0, failedList: [] });
    return { sent: 0, errorCount: 0, skipped: 0 };
  }

  // Filtrar turnos de demo
  const toSend = reservations.filter((r) => r.notes !== '[TEST]');
  const skipped = reservations.length - toSend.length;

  console.log(`[Recordatorios] ${toSend.length} a enviar, ${skipped} omitidos (demo).`);

  let sent = 0;
  let errors = 0;
  const failedList = [];

  for (let i = 0; i < toSend.length; i++) {
    const r = toSend[i];

    const pushPayload = {
      title: `Recordatorio — ${r.shop.name}`,
      body: `Hoy a las ${r.time}: ${r.activity.title} con ${r.barber.name}`,
      url: `/${r.shop.slug || ''}/turnos?ver=mis-turnos`,
    };

    const [pushResult, emailResult] = await Promise.all([
      sendPushToClient(r.client.phone, pushPayload),
      sendReminderEmail({
        to: r.client.email,
        clientName: r.client.name,
        shopName: r.shop.name,
        activity: r.activity.title,
        barberName: r.barber.name,
        date: r.date,
        time: r.time,
        shopSlug: r.shop.slug,
      }),
    ]);

    const ok = pushResult === 'sent' || emailResult === 'sent';
    if (ok) {
      sent++;
      const channels = [pushResult === 'sent' && 'push', emailResult === 'sent' && 'email'].filter(Boolean).join('+');
      console.log(`[Recordatorios] (${i + 1}/${toSend.length}) ✓ ${r.client.name} (${channels})`);
    } else {
      const reason = `push:${pushResult} email:${emailResult}`;
      console.log(`[Recordatorios] (${i + 1}/${toSend.length}) — ${r.client.name}: ${reason}`);
      if (pushResult === 'error' || emailResult === 'error') {
        errors++;
        failedList.push({ name: r.client.name, phone: r.client.phone, error: reason });
      }
    }
  }

  console.log(`[Recordatorios] Listo: ${sent} enviados, ${errors} errores, ${skipped} omitidos.`);
  await ReminderLog.create({ date: today, sent, errorCount: errors, skipped, failedList });

  return { sent, errorCount: errors, skipped };
}

export function startReminderJob() {
  cron.schedule('0 8 * * *', () => {
    runReminders().catch((e) => console.error('[Recordatorios] Error inesperado:', e.message));
  }, { timezone: 'America/Argentina/Buenos_Aires' });

  console.log('[Recordatorios] Cron de recordatorios registrado (8:00 AM Argentina).');
}
