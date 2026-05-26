import Schedule from '../models/Schedule.js';
import Reservation from '../models/Reservation.js';

export const getSchedules = async (req, res) => {
  try {
    const shop = req.user?.shop || req.query.shop;
    const filter = shop ? { shop } : {};
    const schedules = await Schedule.find(filter).populate('barber', 'name surchargeType surchargeValue');
    res.json({ ok: true, schedules });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo horarios' });
  }
};

export const createSchedule = async (req, res) => {
  try {
    if (req.userType !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Solo administradores pueden crear horarios' });
    }
    const { barber, weekday, startTime, endTime, slotMinutes, shop } = req.body;

    const existing = await Schedule.findOne({ barber, weekday });
    if (existing) {
      return res.status(400).json({ ok: false, msg: 'El barbero ya tiene un horario asignado para ese día' });
    }

    const schedule = new Schedule({
      shop: shop || req.user.shop,
      barber,
      weekday,
      startTime,
      endTime,
      slotMinutes: slotMinutes || 45,
    });
    await schedule.save();
    res.status(201).json({ ok: true, schedule });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error creando horario' });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const current = await Schedule.findById(id);
    if (!current) {
      return res.status(404).json({ ok: false, msg: 'Horario no encontrado' });
    }

    const newBarber = req.body.barber || current.barber;
    const newWeekday = req.body.weekday !== undefined ? req.body.weekday : current.weekday;
    const conflict = await Schedule.findOne({ barber: newBarber, weekday: newWeekday, _id: { $ne: id } });
    if (conflict) {
      return res.status(400).json({ ok: false, msg: 'El barbero ya tiene un horario asignado para ese día' });
    }

    const schedule = await Schedule.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ ok: true, schedule });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error actualizando horario' });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ ok: false, msg: 'Horario no encontrado' });
    }

    // Verificar turnos pendientes/confirmados futuros en ese día de semana
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const upcoming = await Reservation.find({
      barber: schedule.barber,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: todayStr },
    }).select('date');

    const onSameWeekday = upcoming.filter((r) => {
      // Parsear la fecha al mediodía para evitar problemas de zona horaria
      const d = new Date(`${r.date}T12:00:00`);
      return d.getDay() === schedule.weekday;
    });

    if (onSameWeekday.length > 0) {
      const n = onSameWeekday.length;
      return res.status(400).json({
        ok: false,
        msg: `Hay ${n} turno${n !== 1 ? 's' : ''} pendiente${n !== 1 ? 's' : ''} en ese día. Cancelalos antes de eliminar el horario.`,
      });
    }

    await Schedule.findByIdAndDelete(id);
    res.json({ ok: true, msg: 'Horario eliminado' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error eliminando horario' });
  }
};
