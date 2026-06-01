import Plan from '../models/Plan.js';

export const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort('price');
    res.json({ ok: true, plans });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error obteniendo planes' });
  }
};

export const createPlan = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo superadmin puede crear planes' });
    }
    const { name, description, price, maxBarbers, includesReminders, includesEmailNotifications } = req.body;
    const plan = new Plan({ name, description, price, maxBarbers, includesReminders, includesEmailNotifications: includesEmailNotifications !== false });
    await plan.save();
    res.status(201).json({ ok: true, plan });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error creando plan' });
  }
};

export const updatePlan = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo superadmin puede editar planes' });
    }
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ ok: false, msg: 'Plan no encontrado' });
    res.json({ ok: true, plan });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error actualizando plan' });
  }
};

export const deletePlan = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo superadmin puede eliminar planes' });
    }
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ ok: true, msg: 'Plan eliminado' });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error eliminando plan' });
  }
};
