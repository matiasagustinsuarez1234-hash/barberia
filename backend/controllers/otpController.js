import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.js';
import Client from '../models/Client.js';
import Reservation from '../models/Reservation.js';
import Barber from '../models/Barber.js';
import Activity from '../models/Activity.js';
import Barbershop from '../models/Barbershop.js';
import { send as waSend } from '../utils/whatsappManager.js';

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

// --- REGISTRO ---

// Paso 1: envia OTP para registrar un cliente nuevo
export const sendRegisterOtp = async (req, res) => {
  try {
    const { phone, name, email, shopSlug } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ ok: false, msg: 'Nombre y celular son obligatorios' });
    }

    const existing = await Client.findOne({ phone });
    if (existing) {
      return res.status(400).json({ ok: false, alreadyRegistered: true, msg: 'Ese celular ya esta registrado. Podes ingresar directamente.' });
    }

    const code = generateCode();
    await Otp.deleteMany({ phone });
    await Otp.create({ phone, code, name, email });

    try {
      const regShop = shopSlug ? await (await import('../models/Barbershop.js')).default.findOne({ slug: shopSlug.toLowerCase() }) : null;
      if (regShop?.whatsappEnabled) {
        await waSend(regShop._id.toString(), phone, `*Codigo de verificacion*\n\nHola ${name}! Tu codigo es: *${code}*\n\nValido por 10 minutos.`);
      }
    } catch (waError) {
      console.warn(`[OTP-Register] WhatsApp no pudo enviar a ${phone}. Codigo: ${code} — Error: ${waError.message}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('sendRegisterOtp error:', error);
    res.status(500).json({ ok: false, msg: 'Error enviando codigo. Verifica que el numero sea correcto.' });
  }
};

// Paso 2: verifica OTP, crea el cliente y devuelve JWT
export const verifyRegisterOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos' });
    }

    const otp = await Otp.findOne({ phone });
    if (!otp) {
      return res.status(400).json({ ok: false, msg: 'El codigo expiro o no existe. Solicita uno nuevo.' });
    }
    if (otp.code !== String(code)) {
      return res.status(400).json({ ok: false, msg: 'Codigo incorrecto' });
    }

    await Otp.deleteMany({ phone });

    // Verificar si el cliente ya existe (por si hubo una prueba previa)
    let client = await Client.findOne({ phone });
    if (!client) {
      client = await Client.create({ name: otp.name, phone, email: otp.email || '' });
    }

    const token = jwt.sign(
      { uid: client._id, role: 'client', type: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    );

    return res.status(201).json({ ok: true, token, userType: 'client', name: client.name });
  } catch (error) {
    console.error('verifyRegisterOtp error:', error);
    res.status(500).json({ ok: false, msg: 'Error confirmando registro' });
  }
};

// --- BOOKING (flujo existente) ---

// Verifica si el cliente ya existe. Si es nuevo, envia OTP.
export const sendOtp = async (req, res) => {
  try {
    const { phone, name, email, shopSlug } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ ok: false, msg: 'Nombre y celular son obligatorios' });
    }

    const existing = await Client.findOne({ phone });
    if (existing) {
      return res.json({ ok: true, clientExists: true });
    }

    const code = generateCode();
    await Otp.deleteMany({ phone });
    await Otp.create({ phone, code, name, email });

    try {
      const otpShop = shopSlug ? await (await import('../models/Barbershop.js')).default.findOne({ slug: shopSlug.toLowerCase() }) : null;
      if (otpShop?.whatsappEnabled) {
        await waSend(otpShop._id.toString(), phone, `*Codigo de verificacion*\n\nHola ${name}! Tu codigo es: *${code}*\n\nValido por 10 minutos.`);
      }
    } catch (waError) {
      // WhatsApp fallo pero el OTP ya esta guardado en MongoDB; se permite continuar
      console.warn(`[OTP] WhatsApp no pudo enviar a ${phone}. Codigo: ${code} — Error: ${waError.message}`);
    }

    res.json({ ok: true, clientExists: false });
  } catch (error) {
    console.error('sendOtp error:', error);
    res.status(500).json({ ok: false, msg: 'Error enviando codigo. Verifica que el numero sea correcto.' });
  }
};

// Para clientes NUEVOS: valida OTP + crea cliente + crea turno
export const verifyAndBook = async (req, res) => {
  try {
    const { phone, code, shopSlug, barberId, activityId, date, time, notes, additionalMembers } = req.body;

    if (!phone || !code || !shopSlug || !barberId || !activityId || !date || !time) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos para confirmar el turno' });
    }

    const otp = await Otp.findOne({ phone });
    if (!otp) {
      return res.status(400).json({ ok: false, msg: 'El codigo expiro o no existe. Solicita uno nuevo.' });
    }
    if (otp.code !== String(code)) {
      return res.status(400).json({ ok: false, msg: 'Codigo incorrecto' });
    }

    await Otp.deleteMany({ phone });

    // Buscar cliente existente antes de crear para evitar error de clave duplicada
    let client = await Client.findOne({ phone });
    if (!client) {
      client = await Client.create({ name: otp.name, phone, email: otp.email || '' });
    }

    return await _createReservation({ client, shopSlug, barberId, activityId, date, time, notes, additionalMembers, res });
  } catch (error) {
    console.error('verifyAndBook error:', error);
    res.status(500).json({ ok: false, msg: 'Error confirmando el turno' });
  }
};

// Para clientes EXISTENTES: crea el turno directamente sin OTP
export const bookExisting = async (req, res) => {
  try {
    const { phone, shopSlug, barberId, activityId, date, time, notes, additionalMembers } = req.body;

    if (!phone || !shopSlug || !barberId || !activityId || !date || !time) {
      return res.status(400).json({ ok: false, msg: 'Faltan datos para reservar' });
    }

    const client = await Client.findOne({ phone });
    if (!client) {
      return res.status(400).json({ ok: false, msg: 'Cliente no encontrado' });
    }

    return await _createReservation({ client, shopSlug, barberId, activityId, date, time, notes, additionalMembers, res });
  } catch (error) {
    console.error('bookExisting error:', error);
    res.status(500).json({ ok: false, msg: 'Error creando el turno' });
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

async function _createReservation({ client, shopSlug, barberId, activityId, date, time, notes, additionalMembers, res }) {
  const [barber, activity, shop] = await Promise.all([
    Barber.findById(barberId),
    Activity.findById(activityId),
    Barbershop.findOne({ slug: shopSlug.toLowerCase() }),
  ]);

  if (!barber || !activity || !shop) {
    return res.status(400).json({ ok: false, msg: 'Datos de reserva invalidos' });
  }

  const existingReservations = await Reservation.find({
    barber: barberId,
    date,
    status: { $ne: 'cancelled' },
  }).populate('activity', 'durationMinutes');

  const takenRanges = existingReservations.map((r) => {
    const start = timeToMinutes(r.time);
    return { start, end: start + (r.activity?.durationMinutes ?? 30) };
  });

  const hasOverlap = (startMin, endMin) =>
    takenRanges.some((r) => startMin < r.end && endMin > r.start);

  const newStart = timeToMinutes(time);
  const newEnd = newStart + activity.durationMinutes;

  if (hasOverlap(newStart, newEnd)) {
    return res.status(409).json({ ok: false, msg: 'Ese horario ya fue tomado. Elige otro.' });
  }

  // Verificar que el cliente no tenga ya un turno ese dia (mismo celular)
  const clientDayConflict = await Reservation.findOne({ client: client._id, date, status: { $ne: 'cancelled' } });
  if (clientDayConflict) {
    return res.status(409).json({ ok: false, msg: `Ya tenes un turno reservado para ese dia a las ${clientDayConflict.time}. Cancela el anterior si queres cambiarlo.` });
  }

  // Verificar conflictos para los turnos adicionales del grupo
  if (additionalMembers?.length) {
    for (const member of additionalMembers) {
      const mStart = timeToMinutes(member.time);
      const mEnd = mStart + activity.durationMinutes;
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
    client: client._id,
    date,
    time,
    endTime,
    notes: notes || '',
    status: 'pending',
  });

  // Crear reservas adicionales para los integrantes del grupo
  const extraReservations = [];
  if (additionalMembers?.length) {
    for (const member of additionalMembers) {
      const memberNotes = member.name + (notes ? ` — ${notes}` : '');
      const r = await Reservation.create({
        shop: shop._id,
        barber: barberId,
        activity: activityId,
        client: client._id,
        date,
        time: member.time,
        notes: memberNotes,
        status: 'pending',
      });
      extraReservations.push(r);
    }
  }

  const populateFields = [
    { path: 'barber', select: 'name whatsapp' },
    { path: 'activity', select: 'title price' },
    { path: 'client', select: 'name phone' },
  ];

  const allReservations = [reservation, ...extraReservations];
  const populated = await Promise.all(allReservations.map((r) => r.populate(populateFields)));

  // Mensaje de confirmacion por WhatsApp
  let finalPrice = activity.price;
  if (barber.surchargeType === 'percent' && barber.surchargeValue) {
    finalPrice = Math.round(activity.price * (1 + barber.surchargeValue / 100));
  } else if (barber.surchargeType === 'fixed' && barber.surchargeValue) {
    finalPrice = activity.price + barber.surchargeValue;
  }
  const priceLabel = `$${finalPrice.toLocaleString('es-AR')}`;

  let confirmMsg = `*TURNO RESERVADO*\n\nHola ${client.name}!\nTu turno en *${shop.name}* fue registrado.\n\n`;

  if (additionalMembers?.length) {
    confirmMsg += `*Reservas del grupo:*\n`;
    confirmMsg += `• ${client.name}: ${time}\n`;
    additionalMembers.forEach((m) => { confirmMsg += `• ${m.name}: ${m.time}\n`; });
    confirmMsg += `\nServicio: ${activity.title}\nBarbero: ${barber.name}\nFecha: ${date}\nPrecio: ${priceLabel}\n\nTe esperamos!`;
  } else {
    confirmMsg +=
      `Servicio: ${activity.title}\n` +
      `Barbero: ${barber.name}\n` +
      `Fecha: ${date}\n` +
      `Hora: ${time}\n` +
      `Precio: ${priceLabel}\n\n` +
      `Te esperamos!`;
  }

  if (shop.whatsappEnabled) {
    waSend(shop._id.toString(), client.phone, confirmMsg).catch((e) => console.warn('WA confirmacion cliente error:', e));
  }

  if (shop.whatsappEnabled && shop.whatsappNumber) {
    const adminMsg =
      `*Nuevo turno reservado*\n\n` +
      `Cliente: ${client.name} (${client.phone})\n` +
      `Servicio: ${activity.title}\n` +
      `Barbero: ${barber.name}\n` +
      `Fecha: ${date}\n` +
      `Hora: ${time}`;
    waSend(shop._id.toString(), shop.whatsappNumber, adminMsg).catch((e) => console.warn('WA notificacion admin error:', e));
  }

  return res.status(201).json({ ok: true, reservation: populated[0], reservations: populated });
}




