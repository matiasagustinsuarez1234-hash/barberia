import express from 'express';
import { getPublicShops, getShopBySlug, getPublicBarbers, getPublicActivities, getAvailableSlots, getPublicClosedDays } from '../controllers/publicController.js';

const router = express.Router();

router.get('/shops', getPublicShops);
router.get('/shops/slug/:slug', getShopBySlug);
router.get('/barbers', getPublicBarbers);
router.get('/activities', getPublicActivities);
router.get('/slots', getAvailableSlots);
router.get('/closed-days', getPublicClosedDays);

export default router;
