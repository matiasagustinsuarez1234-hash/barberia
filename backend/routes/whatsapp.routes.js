import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import {
  centralStatus, centralConnect, centralQr, centralDisconnect,
  toggleShopWhatsapp, shopsWhatsappStatus,
  getMetaCreds, saveMetaCreds, clearMetaCreds,
  status, connect, qr, disconnectWA,
} from '../controllers/whatsappController.js';

const router = express.Router();
router.use(validateJWT);

// Sesión central (superadmin)
router.get('/central/status', centralStatus);
router.get('/central/qr', centralQr);
router.post('/central/connect', centralConnect);
router.post('/central/disconnect', centralDisconnect);
router.get('/central/shops', shopsWhatsappStatus);
router.patch('/central/shops/:id/toggle', toggleShopWhatsapp);

// Meta Business API (shop propio)
router.get('/meta', getMetaCreds);
router.put('/meta', saveMetaCreds);
router.delete('/meta', clearMetaCreds);

// Sesión por shop (legacy)
router.get('/status', status);
router.get('/qr', qr);
router.post('/connect', connect);
router.post('/disconnect', disconnectWA);

export default router;
