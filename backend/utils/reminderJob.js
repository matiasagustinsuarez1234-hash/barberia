import cron from 'node-cron';
import Reservation from '../models/Reservation.js';
import ReminderLog from '../models/ReminderLog.js';
import { sendPushToClient } from './pushManager.js';

export async function runReminders() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Recordatorios] Buscando turnos pendientes para ${today}...`);

  const reservations = await Reservation.find({ date: today, status: 'pending' }).populate([
    { path: 'client', select: 'name phone' },
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

    const pushResult = await sendPushToClient(r.client.phone, {
      title: `Recordatorio — ${r.shop.name}`,
      body: `Hoy a las ${r.time}: ${r.activity.title} con ${r.barber.name}`,
      url: `/${r.shop.slug || ''}/turnos`,
    });

    if (pushResult === 'sent') {
      sent++;
      console.log(`[Recordatorios] (${i + 1}/${toSend.length}) ✓ ${r.client.name}`);
    } else {
      // no_subscription, expired, error — contar como omitido, no como error
      skipped;
      const reason = pushResult === 'no_subscription' ? 'sin suscripción' : pushResult;
      console.log(`[Recordatorios] (${i + 1}/${toSend.length}) — ${r.client.name}: ${reason}`);
      if (pushResult === 'error') {
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
