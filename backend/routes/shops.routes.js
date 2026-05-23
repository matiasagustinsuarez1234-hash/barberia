import express from 'express';
import { validateJWT } from '../middlewares/validateJWT.js';
import { upload } from '../middlewares/upload.js';
import { getShops, createShop, updateShop, deleteShop, togglePayment, updateWhatsappNumber } from '../controllers/shopController.js';

const router = express.Router();
router.use(validateJWT);

const shopUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]);

router.get('/', getShops);
router.post('/', shopUpload, createShop);
router.put('/:id', shopUpload, updateShop);
router.delete('/:id', deleteShop);
router.patch('/:id/payment', togglePayment);
router.patch('/:id/whatsapp-number', updateWhatsappNumber);

export default router;
