import Barber from '../models/Barber.js';
import Activity from '../models/Activity.js';
import Reservation from '../models/Reservation.js';
import Schedule from '../models/Schedule.js';
import Barbershop from '../models/Barbershop.js';
import ClosedDay from '../models/ClosedDay.js';
import WorkableFeriado from '../models/WorkableFeriado.js';
import Client from '../models/Client.js';
import { send as waSend } from '../utils/whatsappManager.js';
import { getArgentinaFeriados } from '../utils/feriados.js';

export const getPublicShops = async (req, res) => {
  try {
    const shops = await Barbershop.find({ active: true }).select('name address phone whatsappNumber mercadopagoEnabled slug');
    res.json({ ok: true, shops });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo barberias' });
  }
};

export const getShopBySlug = async (req, res) => {
  try {
    const shop = await Barbershop.findOne({ slug: req.params.slug.toLowerCase(), active: true })
      .select('name address phone whatsappNumber mercadopagoEnabled slug logo image areaCode');
    if (!shop) return res.status(404).json({ ok: false, msg: 'Barberia no encontrada' });
    res.json({ ok: true, shop });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo barberia' });
  }
};

export const getPublicBarbers = async (req, res) => {
  try {
    const { shop } = req.query;
    const filter = { active: true };
    if (shop) filter.shop = shop;
    const barbers = await Barber.find(filter).select('name specialties surchargeType surchargeValue').sort('name');
    res.json({ ok: true, barbers });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo barberos' });
  }
};

export const getPublicActivities = async (req, res) => {
  try {
    const { shop } = req.query;
    const filter = { active: true };
    if (shop) filter.shop = shop;
    const activities = await Activity.find(filter).select('title description durationMinutes price').sort('title');
    res.json({ ok: true, activities });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo actividades' });
  }
};

export const getPublicClosedDays = async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ ok: false, msg: 'Falta shop' });
    const days = await ClosedDay.find({ shop }).select('date');
    const year = new Date().getFullYear();
    const feriados = getArgentinaFeriados(year).map((f) => f.date);
    const nextYearFeriados = getArgentinaFeriados(year + 1).map((f) => f.date);
    const allFeriados = [...feriados, ...nextYearFeriados];

    // Excluir feriados que la barbería eligió trabajar
    const worked = await WorkableFeriado.find({ shop }).select('date');
    const workedSet = new Set(worked.map((w) => w.date));
    const feriadosActivos = allFeriados.filter((d) => !workedSet.has(d));

    const allClosed = [...new Set([...days.map((d) => d.date), ...feriadosActivos])];
    res.json({ ok: true, closedDates: allClosed });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo dias cerrados' });
  }
};

export const getPublicFeriados = (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  res.json({ ok: true, feriados: getArgentinaFeriados(year) });
};

export const getAvailableSlots = async (req, res) => {
  try {
    const { barber, date, activity: activityId } = req.query;
    if (!barber || !date || !activityId) {
      return res.status(400).json({ ok: false, msg: 'Faltan parametros barber, date y activity' });
    }

    const activity = await Activity.findById(activityId);
    if (!activity) return res.status(404).json({ ok: false, msg: 'Actividad no encontrada' });

    const dateObj = new Date(date + 'T00:00:00');
    const weekday = dateObj.getUTCDay();

    const schedule = await Schedule.findOne({ barber, weekday, active: true });
    if (!schedule) {
      return res.json({ ok: true, slots: [] });
    }

    const barberDoc = await Barber.findById(barber).select('shop');
    if (barberDoc) {
      const closed = await ClosedDay.findOne({ shop: barberDoc.shop, date });
      if (closed) return res.json({ ok: true, slots: [], closed: true });
    }

    const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotMinutes);

    const taken = await Reservation.find({
      barber,
      date,
      status: { $ne: 'cancelled' },
    }).populate('activity', 'durationMinutes');

    const takenRanges = taken.map((r) => {
      const start = timeToMinutes(r.time);
      return { start, end: start + (r.activity?.durationMinutes ?? schedule.slotMinutes) };
    });

    const scheduleEnd = timeToMinutes(schedule.endTime);
    const actDuration = activity.durationMinutes;

    const available = slots.filter((slot) => {
      const start = timeToMinutes(slot);
      const end = start + actDuration;
      if (end > scheduleEnd) return false;
      return !takenRanges.some((r) => start < r.end && end > r.start);
    });

    res.json({ ok: true, slots: available, slotMinutes: schedule.slotMinutes });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo slots' });
  }
};

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export const cancelOwnReservation = async (req, res) => {
  try {
    const { phone, reservationId } = req.body;
    if (!phone || !reservationId) return res.status(400).json({ ok: false, msg: 'Faltan datos' });

    const client = await Client.findOne({ phone });
    if (!client) return res.status(404).json({ ok: false, msg: 'Cliente no encontrado' });

    const reservation = await Reservation.findById(reservationId).populate([
      { path: 'shop', select: 'name slug whatsappEnabled whatsappNumber' },
      { path: 'barber', select: 'name' },
      { path: 'activity', select: 'title' },
    ]);
    if (!reservation) return res.status(404).json({ ok: false, msg: 'Turno no encontrado' });
    if (reservation.client.toString() !== client._id.toString()) {
      return res.status(403).json({ ok: false, msg: 'No autorizado' });
    }
    if (reservation.status === 'cancelled') {
      return res.status(400).json({ ok: false, msg: 'El turno ya está cancelado' });
    }

    reservation.status = 'cancelled';
    await reservation.save();

    const { shop, barber, activity } = reservation;
    if (shop?.whatsappEnabled) {
      const bookingLink = shop.slug ? `\n${process.env.PUBLIC_URL}/${shop.slug}/turnos` : '';
      waSend(shop._id.toString(), client.phone,
        `*Turno cancelado*\n\n` +
        `Hola ${client.name}, tu turno en *${shop.name}* fue cancelado.\n\n` +
        `Servicio: ${activity.title}\n` +
        `Barbero: ${barber.name}\n` +
        `Fecha: ${reservation.date}\n` +
        `Hora: ${reservation.time}\n\n` +
        `Podés reservar un nuevo turno cuando quieras:${bookingLink}`
      ).catch(() => {});

      if (shop.whatsappNumber) {
        waSend(shop._id.toString(), shop.whatsappNumber,
          `*Turno cancelado por el cliente*\n\n` +
          `${client.name} (${client.phone}) canceló su turno.\n\n` +
          `Servicio: ${activity.title}\n` +
          `Barbero: ${barber.name}\n` +
          `Fecha: ${reservation.date}\n` +
          `Hora: ${reservation.time}`
        ).catch(() => {});
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error cancelando turno' });
  }
};

function generateSlots(startTime, endTime, slotMinutes) {
  const slots = [];
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let current = sh * 60 + sm;
  const end = eh * 60 + em;
  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h}:${m === 0 ? '00' : String(m).padStart(2, '0')}`);
    current += slotMinutes;
  }
  return slots;
}
