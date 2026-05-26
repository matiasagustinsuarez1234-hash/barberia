import { encrypt } from '../utils/tokenCrypto.js';
import Barbershop from '../models/Barbershop.js';

// --- Meta Business API (shop propio) ---

export const getMetaCreds = async (req, res) => {
  try {
    const shopId = req.user?.shop?.toString();
    if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
    const shop = await Barbershop.findById(shopId, 'metaWaPhoneNumberId metaWaToken').lean();
    res.json({
      ok: true,
      configured: !!(shop?.metaWaPhoneNumberId && shop?.metaWaToken),
      phoneNumberId: shop?.metaWaPhoneNumberId ?? null,
      hasToken: !!shop?.metaWaToken,
    });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error obteniendo credenciales' });
  }
};

export const saveMetaCreds = async (req, res) => {
  try {
    const shopId = req.user?.shop?.toString();
    if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
    const { phoneNumberId, token } = req.body;
    if (!phoneNumberId || !token) return res.status(400).json({ ok: false, msg: 'Faltan phoneNumberId y token' });
    await Barbershop.findByIdAndUpdate(shopId, { metaWaPhoneNumberId: phoneNumberId, metaWaToken: encrypt(token) });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error guardando credenciales' });
  }
};

export const clearMetaCreds = async (req, res) => {
  try {
    const shopId = req.user?.shop?.toString();
    if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
    await Barbershop.findByIdAndUpdate(shopId, { $unset: { metaWaPhoneNumberId: '', metaWaToken: '' } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, msg: 'Error eliminando credenciales' });
  }
};
