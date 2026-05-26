import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { getMetaCreds, saveMetaCreds, clearMetaCreds } from '../controllers/whatsappController.js';

const router = express.Router();
router.use(validateJWT);

// Meta Business API (solo para negocios que tengan cuenta Meta verificada)
router.get('/meta', getMetaCreds);
router.put('/meta', saveMetaCreds);
router.delete('/meta', clearMetaCreds);

export default router;
