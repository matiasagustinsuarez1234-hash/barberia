import cron from 'node-cron';
import Reservation from '../models/Reservation.js';
import Subscription from '../models/Subscription.js';
import { send as waSend } from './whatsappManager.js';

async function sendDailyReminders() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Recordatorios] Buscando turnos pendientes para ${today}...`);

  const reservations = await Reservation.find({ date: today, status: 'pending' }).populate([
    { path: 'client', select: 'name phone' },
    { path: 'barber', select: 'name' },
    { path: 'activity', select: 'title' },
    { path: 'shop', select: 'name' },
  ]);

  if (reservations.length === 0) {
    console.log('[Recordatorios] Sin turnos pendientes para hoy.');
    return;
  }

  // Agrupar suscripciones por shop para no consultar la BD N veces
  const shopIds = [...new Set(reservations.map((r) => r.shop._id.toString()))];
  const subs = await Subscription.find({ shop: { $in: shopIds }, status: 'active' }).populate('plan', 'includesReminders');
  const subByShop = Object.fromEntries(subs.map((s) => [s.shop.toString(), s]));

  let sent = 0;
  let skipped = 0;

  for (const r of reservations) {
    const shopId = r.shop._id.toString();
    const sub = subByShop[shopId];

    if (!sub?.plan?.includesReminders) {
      skipped++;
      continue;
    }

    const msg =
      `*Recordatorio de turno*\n\n` +
      `Hola ${r.client.name}, te recordamos que hoy tenes un turno en *${r.shop.name}*.\n\n` +
      `Servicio: ${r.activity.title}\n` +
      `Barbero: ${r.barber.name}\n` +
      `Hora: ${r.time}\n\n` +
      `Si necesitas cancelar podes hacerlo desde la web. Hasta luego!`;

    try {
      await waSend(shopId, r.client.phone, msg);
      sent++;
      console.log(`[Recordatorios] Enviado a ${r.client.name} (${r.client.phone})`);
    } catch (e) {
      console.warn(`[Recordatorios] Error enviando a ${r.client.phone}:`, e.message);
    }
  }

  console.log(`[Recordatorios] Listo: ${sent} enviados, ${skipped} omitidos (sin plan con recordatorios).`);
}

export function startReminderJob() {
  // Todos los dias a las 8:00 AM
  cron.schedule('0 8 * * *', () => {
    sendDailyReminders().catch((e) => console.error('[Recordatorios] Error inesperado:', e.message));
  }, { timezone: 'America/Argentina/Buenos_Aires' });

  console.log('[Recordatorios] Cron de recordatorios registrado (8:00 AM Argentina).');
}
