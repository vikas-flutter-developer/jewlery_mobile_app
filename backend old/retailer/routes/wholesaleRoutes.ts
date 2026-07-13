import express from 'express';
import { createWholesaleChallan, createWholesaleInvoice, deleteWholesaleOrder, getWholesaleOrders } from '../controllers/wholesale/wholesaleController.js';

const router = express.Router();

router.get('/', getWholesaleOrders);
router.post('/challan', createWholesaleChallan);
router.post('/invoice', createWholesaleInvoice);
router.delete('/:id', deleteWholesaleOrder);

export default router;


