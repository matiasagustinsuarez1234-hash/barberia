import Reservation from '../models/Reservation.js';
import Client from '../models/Client.js';
import Barber from '../models/Barber.js';
import Activity from '../models/Activity.js';
import { sendPushToClient } from '../utils/pushManager.js';

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
      { path: 'shop', select: 'name whatsappNumber whatsappEnabled notifyAdminOnBooking notifyClientOnBooking' },
    ]);
    res.status(201).json({ ok: true, reservation: populated });

    // Notificaciones post-creación
    try {
      const { shop: s, barber: b, activity: a, client: c } = populated;
      const shopId = s._id.toString();

      // Notificar al admin si tiene número y la opción activada
      if (s?.whatsappEnabled && s?.whatsappNumber && s?.notifyAdminOnBooking !== false) {
        const msg =
          `*Nuevo turno reservado*\n\n` +
          `Cliente: ${c.name} (${c.phone})\n` +
          `Servicio: ${a.title}\n` +
          `Barbero: ${b.name}\n` +
          `Fecha: ${reservation.date}\n` +
          `Hora: ${reservation.time}`;
        waSend(shopId, s.whatsappNumber, msg).catch((e) =>
          console.warn('[WA] Error notificando nuevo turno al admin:', e.message),
        );
      }

      // Notificar al cliente si la opción está activada
      if (s?.whatsappEnabled && s?.notifyClientOnBooking !== false) {
        const clientMsg =
          `*Tu turno está confirmado* ✅\n\n` +
          `Hola ${c.name}, registramos tu turno en *${s.name}*.\n\n` +
          `Servicio: ${a.title}\n` +
          `Barbero: ${b.name}\n` +
          `Fecha: ${reservation.date}\n` +
          `Hora: ${reservation.time}`;
        waSend(shopId, c.phone, clientMsg).catch((e) =>
          console.warn('[WA] Error notificando nuevo turno al cliente:', e.message),
        );
      }
    } catch (e) {
      console.warn('[WA] Error preparando notificaciones de nuevo turno:', e.message);
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
      { path: 'shop', select: 'name slug' },
    ]);
    if (!reservation) return res.status(404).json({ ok: false, msg: 'Turno no encontrado' });

    const { client, barber, activity, shop } = reservation;

    const result = await sendPushToClient(client.phone, {
      title: `Recordatorio — ${shop.name}`,
      body: `${activity.title} con ${barber.name} — ${reservation.date} a las ${reservation.time}`,
      url: shop.slug ? `/${shop.slug}/turnos` : '/',
    });

    if (result === 'no_subscription') {
      return res.status(400).json({ ok: false, msg: `${client.name} no tiene notificaciones activadas en su navegador` });
    }
    if (result === 'expired') {
      return res.status(400).json({ ok: false, msg: 'La suscripción del cliente expiró. Debe volver a activar los recordatorios.' });
    }

    res.json({ ok: true });
  } catch (e) {
    console.warn('[Push] Error enviando recordatorio manual:', e.message);
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
