import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { getSubscriptions, getMySubscription, upsertSubscription } from '../controllers/subscriptionController.js';

const router = express.Router();
router.use(validateJWT);

router.get('/', getSubscriptions);
router.get('/mine', getMySubscription);
router.post('/', upsertSubscription);

export default router;
