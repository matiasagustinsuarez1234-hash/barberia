import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { getClosedDays, checkClosedDay, createClosedDay, deleteClosedDay } from '../controllers/closedDayController.js';

const router = express.Router();

router.get('/', validateJWT, getClosedDays);
router.get('/check', validateJWT, checkClosedDay);
router.post('/', validateJWT, createClosedDay);
router.delete('/:id', validateJWT, deleteClosedDay);

export default router;
