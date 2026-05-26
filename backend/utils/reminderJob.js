import cron from 'node-cron';
import Reservation from '../models/Reservation.js';
import Subscription from '../models/Subscription.js';
import ReminderLog from '../models/ReminderLog.js';
import { send as waSend } from './whatsappManager.js';
import { sendPushToClient } from './pushManager.js';

// Pausa entre mensajes para no saturar la API de WhatsApp/Twilio
const DELAY_MS = 2000; // 2 segundos entre cada envío
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    return;
  }

  // Agrupar suscripciones por shop para no consultar la BD N veces
  const shopIds = [...new Set(reservations.map((r) => r.shop._id.toString()))];
  const subs = await Subscription.find({ shop: { $in: shopIds }, status: 'active' }).populate('plan', 'includesReminders');
  const subByShop = Object.fromEntries(subs.map((s) => [s.shop.toString(), s]));

  const toSend = reservations.filter((r) =>
    subByShop[r.shop._id.toString()]?.plan?.includesReminders &&
    r.notes !== '[TEST]'   // ignorar turnos de demo
  );
  const skipped = reservations.length - toSend.length;

  console.log(
    `[Recordatorios] ${toSend.length} a enviar, ${skipped} omitidos (sin plan). ` +
    `Ritmo: 1 cada ${DELAY_MS / 1000}s → ~${Math.ceil(toSend.length * DELAY_MS / 60000)} min.`
  );

  let sent = 0;
  let errors = 0;
  const failedList = [];

  for (let i = 0; i < toSend.length; i++) {
    const r = toSend[i];
    const shopId = r.shop._id.toString();

    const msg =
      `*Recordatorio de turno*\n\n` +
      `Hola ${r.client.name}, te recordamos que hoy tenes un turno en *${r.shop.name}*.\n\n` +
      `Servicio: ${r.activity.title}\n` +
      `Barbero: ${r.barber.name}\n` +
      `Hora: ${r.time}\n\n` +
      `Si necesitas cancelar podes hacerlo desde la web. Hasta luego!`;

    let okChannel = false;

    // Canal 1: WhatsApp
    try {
      await waSend(shopId, r.client.phone, msg);
      okChannel = true;
      console.log(`[Recordatorios] (${i + 1}/${toSend.length}) ✓ WA ${r.client.name}`);
    } catch (e) {
      console.warn(`[Recordatorios] (${i + 1}/${toSend.length}) ✗ WA ${r.client.phone}: ${e.message}`);
    }

    // Canal 2: Push notification (siempre se intenta, independiente de WA)
    const pushPayload = {
      title: `Recordatorio — ${r.shop.name}`,
      body: `Hoy a las ${r.time} tenés turno: ${r.activity.title} con ${r.barber.name}`,
      url: `/${r.shop.slug || ''}/turnos`,
    };
    const pushResult = await sendPushToClient(r.client.phone, pushPayload);
    if (pushResult === 'sent') {
      okChannel = true;
      console.log(`[Recordatorios] (${i + 1}/${toSend.length}) ✓ Push ${r.client.name}`);
    }

    if (okChannel) {
      sent++;
    } else {
      errors++;
      failedList.push({ name: r.client.name, phone: r.client.phone, error: 'Sin canal disponible' });
    }

    if (i < toSend.length - 1) await sleep(DELAY_MS);
  }

  console.log(`[Recordatorios] Listo: ${sent} enviados, ${errors} errores, ${skipped} omitidos.`);

  // Guardar resultado en MongoDB para consulta desde el panel
  await ReminderLog.create({ date: today, sent, errorCount: errors, skipped, failedList });

  return { sent, errorCount: errors, skipped };
}

export function startReminderJob() {
  cron.schedule('0 8 * * *', () => {
    runReminders().catch((e) => console.error('[Recordatorios] Error inesperado:', e.message));
  }, { timezone: 'America/Argentina/Buenos_Aires' });

  console.log('[Recordatorios] Cron de recordatorios registrado (8:00 AM Argentina).');
}
