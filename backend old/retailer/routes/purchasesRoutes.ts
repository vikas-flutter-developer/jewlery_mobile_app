import express from 'express';
import { postInward } from '../controllers/purchases/purchasesController.js';

const router = express.Router();

router.post('/inward', postInward);
router.delete('/:id', (req, res) => res.json({ success: true, message: 'Purchase order deleted' }));

export default router;


