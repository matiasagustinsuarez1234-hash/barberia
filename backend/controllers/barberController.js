import Barber from '../models/Barber.js';
import Reservation from '../models/Reservation.js';
import { checkBarberLimit } from './subscriptionController.js';

export const getBarbers = async (req, res) => {
  try {
    const shop = req.user?.shop || req.query.shop;
    const filter = shop ? { shop } : {};
    const barbers = await Barber.find(filter).sort('name');
    res.json({ ok: true, barbers });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo profesionales' });
  }
};

export const createBarber = async (req, res) => {
  try {
    if (req.userType !== 'admin') {
      return res.status(403).json({ ok: false, msg: 'Solo administradores pueden crear profesionales' });
    }
    const { name, specialties, whatsapp, shop } = req.body;
    const shopId = shop || req.user.shop;
    const limit = await checkBarberLimit(shopId);
    if (!limit.allowed) {
      return res.status(403).json({ ok: false, msg: limit.msg });
    }
    const barber = new Barber({
      shop: shopId,
      name,
      specialties: specialties || [],
      whatsapp,
    });
    await barber.save();
    res.status(201).json({ ok: true, barber });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error creando profesional' });
  }
};

export const updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const barber = await Barber.findByIdAndUpdate(id, data, { new: true });
    if (!barber) {
      return res.status(404).json({ ok: false, msg: 'Profesional no encontrado' });
    }
    res.json({ ok: true, barber });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error actualizando profesional' });
  }
};

export const deleteBarber = async (req, res) => {
  try {
    const { id } = req.params;

    const pendingCount = await Reservation.countDocuments({ barber: id, status: 'confirmed', date: { $gt: new Date() } });
    if (pendingCount > 0) {
      return res.status(409).json({
        ok: false,
        msg: `No se puede eliminar el profesional porque tiene ${pendingCount} turno${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''}.`,
      });
    }

    await Barber.findByIdAndDelete(id);
    res.json({ ok: true, msg: 'Profesional eliminado' });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error eliminando Profesional' });
  }
};
