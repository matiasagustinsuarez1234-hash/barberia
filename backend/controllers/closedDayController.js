import ClosedDay from '../models/ClosedDay.js';
import Reservation from '../models/Reservation.js';
import { send as waSend } from '../utils/whatsappManager.js';
import { sendPushToClient } from '../utils/pushManager.js';
import { sendCancellationEmail } from '../utils/emailManager.js';

export const getClosedDays = async (req, res) => {
  try {
    const shop = req.user.shop;
    const days = await ClosedDay.find({ shop }).sort({ date: 1 });
    res.json({ ok: true, closedDays: days });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo dias cerrados' });
  }
};

// Devuelve cuantos turnos hay en esa fecha, sin cerrar nada aun
export const checkClosedDay = async (req, res) => {
  try {
    const shop = req.user.shop;
    const { date } = req.query;
    if (!date) return res.status(400).json({ ok: false, msg: 'Falta la fecha' });

    const reservations = await Reservation.find({ shop, date, status: { $in: ['pending', 'confirmed'] } })
      .populate('client', 'name phone')
      .populate('barber', 'name')
      .populate('activity', 'title');

    res.json({ ok: true, count: reservations.length, reservations });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error verificando turnos' });
  }
};

export const createClosedDay = async (req, res) => {
  try {
    const shop = req.user.shop;
    const { date, reason } = req.body;
    if (!date) return res.status(400).json({ ok: false, msg: 'Falta la fecha' });

    const existing = await ClosedDay.findOne({ shop, date });
    if (existing) return res.status(409).json({ ok: false, msg: 'Ese dia ya esta marcado como cerrado' });

    // Cancelar todos los turnos activos de ese dia
    const reservations = await Reservation.find({ shop, date, status: { $in: ['pending', 'confirmed'] } })
      .populate('client', 'name phone email')
      .populate('barber', 'name')
      .populate('activity', 'title')
      .populate('shop', 'name slug whatsappEnabled whatsappNumber');

    let cancelledCount = 0;
    for (const r of reservations) {
      r.status = 'cancelled';
      r.cancellationReason = reason || 'No se atiende ese dia';
      await r.save();
      cancelledCount++;

      // Notificar al cliente por WhatsApp, push y email
      try {
        const shopDoc = r.shop;
        if (shopDoc?.whatsappEnabled) {
          const bookingLink = shopDoc.slug ? `\n${process.env.PUBLIC_URL}/${shopDoc.slug}/turnos` : '';
          const msg =
            `*TURNO CANCELADO*\n\n` +
            `Hola ${r.client.name}, tu turno en *${shopDoc.name}* del ${date} fue cancelado.\n\n` +
            `Servicio: ${r.activity?.title}\n` +
            `Barbero: ${r.barber?.name}\n` +
            `Hora: ${r.time}\n` +
            `Motivo: ${r.cancellationReason}\n\n` +
            `Podes reservar un nuevo turno cuando quieras:${bookingLink}`;
          waSend(shopDoc._id.toString(), r.client.phone, msg).catch((e) =>
            console.warn('[WA] Error notificando cancelacion por dia cerrado:', e.message),
          );
        }
        Promise.all([
          sendPushToClient(r.client.phone, {
            title: `Turno cancelado — ${shopDoc.name}`,
            body: `Tu turno del ${date} a las ${r.time} fue cancelado.`,
            url: `/${shopDoc.slug || ''}/turnos`,
          }),
          sendCancellationEmail({
            to: r.client.email,
            clientName: r.client.name,
            shopName: shopDoc.name,
            activity: r.activity?.title,
            barberName: r.barber?.name,
            date,
            time: r.time,
            reason: r.cancellationReason,
            shopSlug: shopDoc.slug,
          }),
        ]).catch((e) => console.warn('[Notify] Error enviando cancelacion por dia cerrado:', e.message));
      } catch (e) {
        console.warn('[Notify] Error preparando notificacion:', e.message);
      }
    }

    const closedDay = await ClosedDay.create({ shop, date, reason });
    res.status(201).json({ ok: true, closedDay, cancelledCount });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error cerrando el dia' });
  }
};

export const deleteClosedDay = async (req, res) => {
  try {
    const shop = req.user.shop;
    const { id } = req.params;
    const day = await ClosedDay.findOne({ _id: id, shop });
    if (!day) return res.status(404).json({ ok: false, msg: 'Dia cerrado no encontrado' });
    await day.deleteOne();
    res.json({ ok: true, msg: 'Dia reabierto correctamente' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error reabriendo el dia' });
  }
};
