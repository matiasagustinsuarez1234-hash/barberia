import Subscription from '../models/Subscription.js';
import Barber from '../models/Barber.js';

export const getSubscriptions = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Acceso denegado' });
    }
    const subs = await Subscription.find().populate('shop', 'name slug').populate('plan', 'name price maxBarbers includesReminders');
    res.json({ ok: true, subscriptions: subs });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error obteniendo suscripciones' });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const shopId = req.user?.shop;
    if (!shopId) return res.json({ ok: true, subscription: null });
    const sub = await Subscription.findOne({ shop: shopId, status: 'active' }).populate('plan');
    res.json({ ok: true, subscription: sub || null });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error obteniendo suscripcion' });
  }
};

export const upsertSubscription = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo superadmin puede asignar planes' });
    }
    const { shop, plan, status } = req.body;
    const sub = await Subscription.findOneAndUpdate(
      { shop },
      { plan, status: status || 'active', startDate: new Date() },
      { returnDocument: 'after', upsert: true },
    ).populate('shop', 'name').populate('plan', 'name price maxBarbers includesReminders');
    res.json({ ok: true, subscription: sub });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error asignando plan' });
  }
};

export const deleteSubscription = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo superadmin puede eliminar suscripciones' });
    }
    await Subscription.findByIdAndDelete(req.params.id);
    res.json({ ok: true, msg: 'Suscripcion eliminada' });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error eliminando suscripcion' });
  }
};

export const checkBarberLimit = async (shopId) => {
  const sub = await Subscription.findOne({ shop: shopId, status: 'active' }).populate('plan');
  if (!sub) return { allowed: true };
  const count = await Barber.countDocuments({ shop: shopId });
  if (count >= sub.plan.maxBarbers) {
    return {
      allowed: false,
      msg: `Tu plan "${sub.plan.name}" permite hasta ${sub.plan.maxBarbers} barbero${sub.plan.maxBarbers > 1 ? 's' : ''}. Ya tenes ${count}. Contacta al administrador para cambiar de plan.`,
    };
  }
  return { allowed: true };
};
