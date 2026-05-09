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

    const conflict = await Reservation.findOne({ barber, date, time, status: { $ne: 'cancelled' } });
    if (conflict) {
      return res.status(409).json({ ok: false, msg: 'Ese horario ya esta tomado' });
    }

    const reservation = new Reservation({
      shop: shop || existsBarber.shop,
      barber,
      activity,
      client: clientId,
      date,
      time,
      notes,
      status: 'pending',
    });

    await reservation.save();
    const populated = await reservation.populate([
      { path: 'barber', select: 'name whatsapp' },
      { path: 'activity', select: 'title price' },
      { path: 'client', select: 'name phone' },
    ]);
    res.status(201).json({ ok: true, reservation: populated });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error creando turno' });
  }
};

export const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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
    await reservation.save();

    if (status === 'cancelled' && req.userType === 'admin') {
      try {
        const shopId = reservation.shop.toString();
        await reservation.populate([
          { path: 'client', select: 'name phone' },
          { path: 'barber', select: 'name' },
          { path: 'activity', select: 'title' },
          { path: 'shop', select: 'name' },
        ]);
        const { client, barber, activity, shop } = reservation;
        const msg =
          `*TURNO CANCELADO*\n\n` +
          `Hola ${client.name}, tu turno en *${shop.name}* fue cancelado.\n\n` +
          `Servicio: ${activity.title}\n` +
          `Barbero: ${barber.name}\n` +
          `Fecha: ${reservation.date}\n` +
          `Hora: ${reservation.time}\n\n` +
          `Podes reservar un nuevo turno cuando quieras.`;
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
