import express from 'express';
import { sendOtp, verifyAndBook, bookExisting, sendRegisterOtp, verifyRegisterOtp, sendCancelOtp, verifyAndGetReservations } from '../controllers/otpController.js';

const router = express.Router();

// Registro de cliente con OTP
router.post('/register/send', sendRegisterOtp);
router.post('/register/verify', verifyRegisterOtp);

// Cancelación por cliente
router.post('/send-cancel', sendCancelOtp);
router.post('/verify-cancel', verifyAndGetReservations);

// Booking (flujo existente)
router.post('/send', sendOtp);
router.post('/verify-and-book', verifyAndBook);
router.post('/book', bookExisting);

export default router;
