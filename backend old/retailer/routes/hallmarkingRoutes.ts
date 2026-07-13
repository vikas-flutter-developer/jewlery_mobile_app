import express from 'express';
import { createHallmarkingBatch, getHallmarkingBatches } from '../controllers/hallmarking/hallmarkingController.js';

const router = express.Router();

router.post('/batches', createHallmarkingBatch);
router.get('/batches', (req, res) => {
  res.json({
    success: true,
    data: getHallmarkingBatches()
  });
});

export default router;


