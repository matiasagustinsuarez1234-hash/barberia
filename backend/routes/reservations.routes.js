import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { getReservations, createReservation, updateReservationStatus, sendReminder } from '../controllers/reservationController.js';

const router = express.Router();
router.use(validateJWT);

router.get('/', getReservations);
router.post('/', createReservation);
router.patch('/:id/status', updateReservationStatus);
router.post('/:id/remind', sendReminder);

export default router;
