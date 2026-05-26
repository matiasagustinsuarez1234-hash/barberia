import express from 'express';
import Client from '../models/Client.js';

const router = express.Router();

// GET /api/push/vapid-key  — clave pública para que el browser se suscriba
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe  — guarda la suscripción del browser para un cliente
router.post('/subscribe', async (req, res) => {
  const { phone, subscription } = req.body;
  if (!phone || !subscription?.endpoint) {
    return res.status(400).json({ ok: false, msg: 'Faltan datos' });
  }
  try {
    await Client.findOneAndUpdate({ phone }, { pushSubscription: subscription });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: 'Error guardando suscripción' });
  }
});

export default router;
