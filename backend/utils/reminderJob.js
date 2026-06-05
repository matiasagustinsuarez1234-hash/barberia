import cron from 'node-cron';
import Reservation from '../models/Reservation.js';
import ReminderLog from '../models/ReminderLog.js';
import Subscription from '../models/Subscription.js';
import { sendPushToClient } from './pushManager.js';
import { sendReminderEmail } from './emailManager.js';

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runReminders() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Recordatorios] Buscando turnos pendientes para ${today}...`);

  const reservations = await Reservation.find({ date: today, status: { $in: ['pending', 'confirmed'] } }).populate([
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

  const toSend = reservations.filter((r) => r.notes !== '[TEST]');
  const skipped = reservations.length - toSend.length;

  console.log(`[Recordatorios] ${toSend.length} a enviar, ${skipped} omitidos (demo).`);

  const shopIds = [...new Set(toSend.map((r) => r.shop._id.toString()))];
  const subscriptions = await Subscription.find({ shop: { $in: shopIds } }).populate('plan', 'includesEmailNotifications');
  const emailEnabledByShop = new Map();
  for (const sub of subscriptions) {
    emailEnabledByShop.set(sub.shop.toString(), sub.plan?.includesEmailNotifications !== false);
  }

  let sent = 0;
  let errors = 0;
  const failedList = [];

  for (let i = 0; i < toSend.length; i++) {
    const r = toSend[i];
    const shopEmailEnabled = emailEnabledByShop.get(r.shop._id.toString()) ?? true;

    const pushPayload = {
      title: `Recordatorio — ${r.shop.name}`,
      body: `Hoy a las ${r.time}: ${r.activity.title} con ${r.barber.name}`,
      url: `/${r.shop.slug || ''}/turnos?ver=mis-turnos`,
    };

    const [pushResult, emailResult] = await Promise.all([
      sendPushToClient(r.client.phone, pushPayload),
      shopEmailEnabled
        ? sendReminderEmail({
            to: r.client.email,
            clientName: r.client.name,
            shopName: r.shop.name,
            activity: r.activity.title,
            barberName: r.barber.name,
            date: r.date,
            time: r.time,
            shopSlug: r.shop.slug,
          })
        : Promise.resolve('no_email'),
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

    // Pausa cada BATCH_SIZE envíos para no saturar el servidor de mail
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < toSend.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`[Recordatorios] Listo: ${sent} enviados, ${errors} errores, ${skipped} omitidos.`);
  await ReminderLog.create({ date: today, sent, errorCount: errors, skipped, failedList });

  return { sent, errorCount: errors, skipped };
}

export function startReminderJob() {
  cron.schedule('0 8 * * *', () => {
    const now = new Date();
    const utc = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const ar = now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    console.log(`[Recordatorios] Cron 8:00 AR — ${utc} | ${ar} — iniciando envío...`);
    runReminders().catch((err) => console.error('[Recordatorios] Error en cron:', err));
  }, { timezone: 'America/Argentina/Buenos_Aires' });

  console.log('[Recordatorios] Cron programado para las 8:00 (Buenos Aires).');
}
