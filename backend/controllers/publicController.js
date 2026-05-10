import Barber from '../models/Barber.js';
import Activity from '../models/Activity.js';
import Reservation from '../models/Reservation.js';
import Schedule from '../models/Schedule.js';
import Barbershop from '../models/Barbershop.js';

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
    const barbers = await Barber.find(filter).select('name specialties').sort('name');
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

export const getAvailableSlots = async (req, res) => {
  try {
    const { barber, date } = req.query;
    if (!barber || !date) {
      return res.status(400).json({ ok: false, msg: 'Faltan parametros barber y date' });
    }

    const dateObj = new Date(date + 'T00:00:00');
    const weekday = dateObj.getUTCDay();

    const schedule = await Schedule.findOne({ barber, weekday, active: true });
    if (!schedule) {
      return res.json({ ok: true, slots: [] });
    }

    const slots = generateSlots(schedule.startTime, schedule.endTime, schedule.slotMinutes);

    const taken = await Reservation.find({
      barber,
      date,
      status: { $ne: 'cancelled' },
    }).select('time');
    const takenTimes = new Set(taken.map((r) => r.time));

    const available = slots.filter((s) => !takenTimes.has(s));
    res.json({ ok: true, slots: available, slotMinutes: schedule.slotMinutes });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo slots' });
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
