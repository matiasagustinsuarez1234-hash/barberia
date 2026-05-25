import { Router } from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import ReminderLog from '../models/ReminderLog.js';
import { runReminders } from '../utils/reminderJob.js';

const router = Router();

// GET /api/reminder-logs  — solo superadmin
router.get('/', validateJWT, async (req, res) => {
  if (req.role !== 'superadmin') return res.status(403).json({ ok: false, msg: 'Sin permiso' });
  const logs = await ReminderLog.find().sort({ runAt: -1 }).limit(60);
  res.json({ ok: true, logs });
});

// POST /api/reminder-logs/run  — dispara el job manualmente (solo superadmin)
router.post('/run', validateJWT, async (req, res) => {
  if (req.role !== 'superadmin') return res.status(403).json({ ok: false, msg: 'Sin permiso' });
  try {
    const result = await runReminders();
    const logs   = await ReminderLog.find().sort({ runAt: -1 }).limit(60);
    res.json({ ok: true, result, logs });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

export default router;
