import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { getPlans, createPlan, updatePlan, deletePlan } from '../controllers/planController.js';

const router = express.Router();
router.use(validateJWT);

router.get('/', getPlans);
router.post('/', createPlan);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;
