import {
  initCentral, getCentralStatus, getCentralQR, disconnectCentral,
  initClient, getStatus, getQR, disconnect as waDisconnect,
} from '../utils/whatsappManager.js';
import { encrypt } from '../utils/tokenCrypto.js';
import Barbershop from '../models/Barbershop.js';

// --- Sesión central (superadmin) ---

export const centralStatus = (req, res) => {
  const { status, phone } = getCentralStatus();
  res.json({ ok: true, status, phone });
};

export const centralConnect = (req, res) => {
  const state = initCentral();
  res.json({ ok: true, status: state.status });
};

export const centralQr = (req, res) => {
  res.json({ ok: true, qr: getCentralQR() });
};

export const centralDisconnect = async (req, res) => {
  await disconnectCentral();
  res.json({ ok: true });
};

// Toggle whatsappEnabled por negocio (superadmin)
export const toggleShopWhatsapp = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo el superadmin puede hacer esto' });
    }
    const { id } = req.params;
    const shop = await Barbershop.findById(id);
    if (!shop) return res.status(404).json({ ok: false, msg: 'Empresa no encontrada' });
    shop.whatsappEnabled = !shop.whatsappEnabled;
    await shop.save();
    res.json({ ok: true, whatsappEnabled: shop.whatsappEnabled });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error actualizando empresa' });
  }
};

// Lista de empresas con su estado de WhatsApp (superadmin)
export const shopsWhatsappStatus = async (req, res) => {
  try {
    if (req.role !== 'superadmin') {
      return res.status(403).json({ ok: false, msg: 'Solo el superadmin puede hacer esto' });
    }
    const shops = await Barbershop.find({}, 'name whatsappEnabled');
    res.json({ ok: true, shops });
  } catch (error) {
    res.status(500).json({ ok: false, msg: 'Error obteniendo empresas' });
  }
};

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

// --- Sesión por shop (legacy, mantenido para futura integración Twilio) ---

export const status = (req, res) => {
  const shopId = req.user?.shop?.toString();
  if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
  res.json({ ok: true, status: getStatus(shopId) });
};

export const connect = (req, res) => {
  const shopId = req.user?.shop?.toString();
  if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
  const state = initClient(shopId);
  res.json({ ok: true, status: state.status });
};

export const qr = (req, res) => {
  const shopId = req.user?.shop?.toString();
  if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
  res.json({ ok: true, qr: getQR(shopId) });
};

export const disconnectWA = async (req, res) => {
  const shopId = req.user?.shop?.toString();
  if (!shopId) return res.status(400).json({ ok: false, msg: 'Sin barbería asignada' });
  await waDisconnect(shopId);
  res.json({ ok: true });
};
