import Otp from '../models/Otp.js';
import Client from '../models/Client.js';
import Reservation from '../models/Reservation.js';
import Barber from '../models/Barber.js';
import Activity from '../models/Activity.js';
import Barbershop from '../models/Barbershop.js';
import { sendPushToClient } from '../utils/pushManager.js';
import { sendConfirmationEmail } from '../utils/emailManager.js';

// --- BOOKING ---

// Verifica si el cliente ya existe. Si es nuevo, lo crea directamente (sin OTP).
export const sendOtp = async (req, res) => {
  try {
    const { phone, name, email } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ ok: false, msg: 'Nombre y celular son obligatorios' });
    }

    let client = await Client.findOne({ phone });
    if (!client) {
      client = await Client.create({ name, phone, email: email || '' });
    } else if (email && email.includes('@') && !client.email) {
      client.email = email;
      await client.save();
    }

    return res.json({ ok: true, clientExists: true });
  } catch (error) {
    console.error('sendOtp error:', error);
    res.status(500).json({ ok: false, msg: 'Error procesando la solicitud' });
  }
};

// Mantener compatibilidad: verify-and-book ya no se usa pero por si acaso redirige a bookExisting
export const verifyAndBook = async (req, res) => {
  return bookExisting(req, res);
};

// Para todos los clientes: crea el turno directamente
export const bookExisting = async (req, res) => {
  try {
    const { phone, shopSlug, barberId, activityId, additionalActivityIds, date, time, notes, additionalMembers } = req.body;

    if (!phone || !shopSlug || !barberId || !activityId || !date || !time) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos para reservar' });
    }

    const client = await Client.findOne({ phone });
    if (!client) {
      return res.status(400).json({ ok: false, msg: 'Cliente no encontrado' });
    }

    return await _createReservation({ client, shopSlug, barberId, activityId, additionalActivityIds, date, time, notes, additionalMembers, res });
  } catch (error) {
    console.error('bookExisting error:', error);
    res.status(500).json({ ok: false, msg: 'Error creando el turno' });
  }
};

// --- CANCELACIÓN POR CLIENTE (sin OTP) ---

export const sendCancelOtp = async (req, res) => {
  // Sin OTP: simplemente confirmamos que el cliente existe
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ ok: false, msg: 'Celular obligatorio' });

    const client = await Client.findOne({ phone });
    if (!client) return res.status(404).json({ ok: false, msg: 'No encontramos turnos para ese número' });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error verificando el número' });
  }
};

export const verifyAndGetReservations = async (req, res) => {
  // Sin OTP: devuelve los turnos por teléfono (+email si el cliente lo tiene registrado)
  try {
    const { phone, shopSlug, email } = req.body;
    if (!phone) return res.status(400).json({ ok: false, msg: 'Faltan datos' });

    const client = await Client.findOne({ phone });
    if (!client) return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });

    if (client.email && email) {
      if (client.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return res.status(400).json({ ok: false, msg: 'El email no coincide con el registrado' });
      }
    }

    const shop = shopSlug ? await Barbershop.findOne({ slug: shopSlug.toLowerCase() }) : null;
    const filter = { client: client._id, status: { $ne: 'cancelled' } };
    if (shop) filter.shop = shop._id;

    const reservations = await Reservation.find(filter)
      .populate('barber', 'name')
      .populate('activity', 'title')
      .sort({ date: 1, time: 1 });

    res.json({ ok: true, reservations });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo turnos' });
  }
};

// Legacy: registro con OTP (no se usa en el flujo actual)
export const sendRegisterOtp = async (req, res) => {
  return res.status(410).json({ ok: false, msg: 'Endpoint obsoleto' });
};
export const verifyRegisterOtp = async (req, res) => {
  return res.status(410).json({ ok: false, msg: 'Endpoint obsoleto' });
};

// --- HELPERS ---

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

async function _createReservation({ client, shopSlug, barberId, activityId, additionalActivityIds, date, time, notes, additionalMembers, res }) {
  const [barber, activity, shop] = await Promise.all([
    Barber.findById(barberId),
    Activity.findById(activityId),
    Barbershop.findOne({ slug: shopSlug.toLowerCase() }),
  ]);

  if (!barber || !activity || !shop) {
    return res.status(400).json({ ok: false, msg: 'Datos de reserva invalidos' });
  }

  // Actividades adicionales
  let extraActivities = [];
  if (additionalActivityIds?.length) {
    extraActivities = await Activity.find({ _id: { $in: additionalActivityIds } });
  }

  const totalDuration = activity.durationMinutes + extraActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

  const existingReservations = await Reservation.find({
    barber: barberId,
    date,
    status: { $ne: 'cancelled' },
  }).populate('activity', 'durationMinutes');

  const takenRanges = existingReservations.map((r) => {
    const start = timeToMinutes(r.time);
    const end = r.endTime ? timeToMinutes(r.endTime) : start + (r.activity?.durationMinutes ?? 30);
    return { start, end };
  });

  const hasOverlap = (startMin, endMin) =>
    takenRanges.some((r) => startMin < r.end && endMin > r.start);

  const newStart = timeToMinutes(time);
  const newEnd = newStart + totalDuration;

  if (hasOverlap(newStart, newEnd)) {
    return res.status(409).json({ ok: false, msg: 'Ese horario ya fue tomado. Elige otro.' });
  }

  const clientDayConflict = await Reservation.findOne({ client: client._id, date, status: { $ne: 'cancelled' } });
  if (clientDayConflict) {
    return res.status(409).json({ ok: false, msg: `Ya tenes un turno reservado para ese dia a las ${clientDayConflict.time}. Cancela el anterior si queres cambiarlo.` });
  }

  if (additionalMembers?.length) {
    for (const member of additionalMembers) {
      const mStart = timeToMinutes(member.time);
      const mEnd = mStart + totalDuration;
      if (hasOverlap(mStart, mEnd)) {
        return res.status(409).json({ ok: false, msg: `El horario ${member.time} ya fue tomado. Intenta de nuevo.` });
      }
    }
  }

  const endTime = minutesToTime(newEnd);

  const reservation = await Reservation.create({
    shop: shop._id,
    barber: barberId,
    activity: activityId,
    additionalActivities: additionalActivityIds || [],
    client: client._id,
    date,
    time,
    endTime,
    notes: notes || '',
    status: 'pending',
  });

  const extraReservations = [];
  if (additionalMembers?.length) {
    for (const member of additionalMembers) {
      const memberNotes = member.name + (notes ? ` — ${notes}` : '');
      const r = await Reservation.create({
        shop: shop._id,
        barber: barberId,
        activity: activityId,
        additionalActivities: additionalActivityIds || [],
        client: client._id,
        date,
        time: member.time,
        endTime: minutesToTime(timeToMinutes(member.time) + totalDuration),
        notes: memberNotes,
        status: 'pending',
      });
      extraReservations.push(r);
    }
  }

  const populateFields = [
    { path: 'barber', select: 'name' },
    { path: 'activity', select: 'title price' },
    { path: 'client', select: 'name phone' },
  ];

  const allReservations = [reservation, ...extraReservations];
  const populated = await Promise.all(allReservations.map((r) => r.populate(populateFields)));

  // Calcular precio
  const calcPrice = (basePrice) => {
    if (barber.surchargeType === 'percent' && barber.surchargeValue)
      return Math.round(basePrice * (1 + barber.surchargeValue / 100));
    if (barber.surchargeType === 'fixed' && barber.surchargeValue)
      return basePrice + barber.surchargeValue;
    return basePrice;
  };

  const allActivities = [activity, ...extraActivities];
  const baseTotal = allActivities.reduce((sum, a) => sum + (a.price || 0), 0);
  const totalPrice = calcPrice(baseTotal);
  const priceLabel = `$${totalPrice.toLocaleString('es-AR')}`;
  const serviceLines = allActivities.map((a) => `• ${a.title}`).join('\n');
  const serviceLabel = allActivities.length === 1 ? activity.title : serviceLines;

  // Push al cliente: confirmación de turno
  const pushBody = additionalMembers?.length
    ? `Grupo confirmado en ${shop.name} — ${date}`
    : `${serviceLabel} con ${barber.name} — ${date} a las ${time} · ${priceLabel}`;

  sendPushToClient(client.phone, {
    title: `✅ Turno confirmado — ${shop.name}`,
    body: pushBody,
    url: `/${shop.slug}/turnos?ver=mis-turnos`,
  }).catch((e) => console.warn('[Push] confirmación cliente:', e.message));


  return res.status(201).json({ ok: true, reservation: populated[0], reservations: populated });
}
