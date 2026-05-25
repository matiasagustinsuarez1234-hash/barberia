import { Router } from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import ReminderLog from '../models/ReminderLog.js';

const router = Router();

// GET /api/reminder-logs  — solo superadmin
router.get('/', validateJWT, async (req, res) => {
  if (req.role !== 'superadmin') return res.status(403).json({ ok: false, msg: 'Sin permiso' });
  const logs = await ReminderLog.find().sort({ runAt: -1 }).limit(60);
  res.json({ ok: true, logs });
});

export default router;
