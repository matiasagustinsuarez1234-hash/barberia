import Reservation from '../models/Reservation.js';
import Client from '../models/Client.js';
import Barber from '../models/Barber.js';
import Activity from '../models/Activity.js';
import { send as waSend } from '../utils/whatsappManager.js';

export const getReservations = async (req, res) => {
  try {
    const filter = {};
    if (req.userType === 'admin') {
      if (req.role !== 'superadmin') filter.shop = req.user.shop;
    } else {
      filter.client = req.uid;
    }

    const reservations = await Reservation.find(filter)
      .populate('client', 'name phone')
      .populate('barber', 'name')
      .populate('activity', 'title price')
      .sort({ date: -1, time: 1 });

    res.json({ ok: true, reservations });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo turnos' });
  }
};

export const createReservation = async (req, res) => {
  try {
    const { barber, activity, date, time, notes, client: clientId } = req.body;
    const shop = req.user.shop;

    const existsBarber = await Barber.findById(barber);
    const existsActivity = await Activity.findById(activity);
    const existsClient = await Client.findById(clientId);

    if (!existsBarber || !existsActivity || !existsClient) {
      return res.status(400).json({ ok: false, msg: 'Datos de reserva invalidos' });
    }

    const existingReservations = await Reservation.find({
      barber,
      date,
      status: { $ne: 'cancelled' },
    }).populate('activity', 'durationMinutes');

    const newStart = timeToMinutes(time);
    const newEnd = newStart + existsActivity.durationMinutes;

    const conflict = existingReservations.some((r) => {
      const rStart = timeToMinutes(r.time);
      const rEnd = rStart + (r.activity?.durationMinutes ?? 30);
      return newStart < rEnd && newEnd > rStart;
    });

    if (conflict) {
      return res.status(409).json({ ok: false, msg: 'Ese horario ya esta tomado' });
    }

    const endTime = minutesToTime(newEnd);

    const reservation = new Reservation({
      shop: shop || existsBarber.shop,
      barber,
      activity,
      client: clientId,
      date,
      time,
      endTime,
      notes,
      status: 'pending',
    });

    await reservation.save();
    const populated = await reservation.populate([
      { path: 'barber', select: 'name whatsapp' },
      { path: 'activity', select: 'title price' },
      { path: 'client', select: 'name phone' },
      { path: 'shop', select: 'name whatsappNumber' },
    ]);
    res.status(201).json({ ok: true, reservation: populated });

    // Notificar al admin de la barbería
    try {
      const { shop: s, barber: b, activity: a, client: c } = populated;
      if (s?.whatsappEnabled && s?.whatsappNumber) {
        const msg =
          `*Nuevo turno reservado*\n\n` +
          `Cliente: ${c.name} (${c.phone})\n` +
          `Servicio: ${a.title}\n` +
          `Barbero: ${b.name}\n` +
          `Fecha: ${reservation.date}\n` +
          `Hora: ${reservation.time}`;
        waSend(s._id.toString(), s.whatsappNumber, msg).catch((e) =>
          console.warn('[WA] Error notificando nuevo turno al admin:', e.message),
        );
      }
    } catch (e) {
      console.warn('[WA] Error preparando notificacion de nuevo turno:', e.message);
    }
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error creando turno' });
  }
};

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export const sendReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id).populate([
      { path: 'client', select: 'name phone' },
      { path: 'barber', select: 'name' },
      { path: 'activity', select: 'title' },
      { path: 'shop', select: 'name slug whatsappEnabled whatsappNumber' },
    ]);
    if (!reservation) return res.status(404).json({ ok: false, msg: 'Turno no encontrado' });
    if (!reservation.shop?.whatsappEnabled) return res.status(400).json({ ok: false, msg: 'WhatsApp deshabilitado para este negocio' });

    const { client, barber, activity, shop } = reservation;
    const shopId = reservation.shop._id.toString();
    const bookingLink = shop.slug ? `\n${process.env.PUBLIC_URL}/${shop.slug}/turnos` : '';
    const msg =
      `*Recordatorio de turno*\n\n` +
      `Hola ${client.name}, te recordamos que tenés un turno en *${shop.name}*.\n\n` +
      `Servicio: ${activity.title}\n` +
      `Barbero: ${barber.name}\n` +
      `Fecha: ${reservation.date}\n` +
      `Hora: ${reservation.time}\n\n` +
      `Para reservar o cancelar tu turno:${bookingLink}`;

    await waSend(shopId, client.phone, msg);

    if (shop.whatsappNumber) {
      const adminMsg =
        `*Recordatorio enviado*\n\n` +
        `Se le envió un recordatorio a ${client.name} por su turno del ${reservation.date} a las ${reservation.time}.`;
      waSend(shopId, shop.whatsappNumber, adminMsg).catch((e) => console.warn('[WA] Error notificando recordatorio al admin:', e.message));
    }
    res.json({ ok: true });
  } catch (e) {
    console.warn('[WA] Error enviando recordatorio manual:', e.message);
    res.status(500).json({ ok: false, msg: 'Error enviando recordatorio' });
  }
};

export const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const allowed = ['pending', 'confirmed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, msg: 'Estado invalido' });
    }

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ ok: false, msg: 'Turno no encontrado' });
    }

    // Clientes solo pueden cancelar sus propios turnos
    if (req.userType === 'client' && reservation.client.toString() !== req.uid) {
      return res.status(403).json({ ok: false, msg: 'No autorizado' });
    }

    reservation.status = status;
    if (status === 'cancelled' && reason) reservation.cancellationReason = reason;
    await reservation.save();

    if (status === 'cancelled' && req.userType === 'admin') {
      try {
        const shopId = reservation.shop.toString();
        await reservation.populate([
          { path: 'client', select: 'name phone' },
          { path: 'barber', select: 'name' },
          { path: 'activity', select: 'title' },
          { path: 'shop', select: 'name slug whatsappEnabled' },
        ]);
        const { client, barber, activity, shop } = reservation;
        if (!shop?.whatsappEnabled) return;
        const msg =
          `*TURNO CANCELADO*\n\n` +
          `Hola ${client.name}, tu turno en *${shop.name}* fue cancelado.\n\n` +
          `Servicio: ${activity.title}\n` +
          `Barbero: ${barber.name}\n` +
          `Fecha: ${reservation.date}\n` +
          `Hora: ${reservation.time}\n` +
          (reservation.cancellationReason ? `Motivo: ${reservation.cancellationReason}\n` : '') +
          `\nPodes reservar un nuevo turno cuando quieras:` +
          (shop.slug ? `\n${process.env.PUBLIC_URL}/${shop.slug}/turnos` : '');
        waSend(shopId, client.phone, msg).catch((e) => console.warn('[WA] Error enviando cancelacion:', e.message));
      } catch (e) {
        console.warn('[WA] Error preparando mensaje de cancelacion:', e.message);
      }
    }

    res.json({ ok: true, reservation });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error actualizando turno' });
  }
};
