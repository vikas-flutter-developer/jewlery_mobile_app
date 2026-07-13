import express from 'express';
import { createPurchaseOrder, updatePurchaseOrderStatus } from '../controllers/po/poController.js';

const router = express.Router();

router.post('/', createPurchaseOrder);
router.put('/:id/status', updatePurchaseOrderStatus);

export default router;


