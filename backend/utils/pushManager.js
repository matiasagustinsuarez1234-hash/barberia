import webpush from 'web-push';
import Client from '../models/Client.js';

webpush.setVapidDetails(
  'mailto:aleprrr@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

/**
 * Envía una notificación push a un cliente por teléfono.
 * Retorna 'sent' | 'no_subscription' | 'expired' | 'error'
 */
export async function sendPushToClient(phone, payload) {
  const client = await Client.findOne({ phone }).select('pushSubscription').lean();
  if (!client?.pushSubscription) return 'no_subscription';

  try {
    await webpush.sendNotification(client.pushSubscription, JSON.stringify(payload));
    return 'sent';
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      // Suscripción vencida — la limpiamos
      await Client.updateOne({ phone }, { pushSubscription: null });
      return 'expired';
    }
    console.warn(`[Push] Error enviando a ${phone}:`, e.message);
    return 'error';
  }
}
