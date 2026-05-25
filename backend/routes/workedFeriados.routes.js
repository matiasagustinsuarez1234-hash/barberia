import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { getWorkedFeriados, addWorkedFeriado, removeWorkedFeriado } from '../controllers/workedFeriadosController.js';

const router = express.Router();

router.get('/', validateJWT, getWorkedFeriados);
router.post('/', validateJWT, addWorkedFeriado);
router.delete('/:date', validateJWT, removeWorkedFeriado);

export default router;
