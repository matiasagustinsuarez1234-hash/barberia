import Schedule from '../models/Schedule.js';

export const getSchedules = async (req, res) => {
  try {
    const shop = req.user?.shop || req.query.shop;
    const filter = shop ? { shop } : {};
    const schedules = await Schedule.find(filter).populate('barber', 'name');
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
    await Schedule.findByIdAndDelete(id);
    res.json({ ok: true, msg: 'Horario eliminado' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error eliminando horario' });
  }
};
