import express from 'express';
import { verifyHuid, getAllHuids } from '../controllers/huid/huidController.js';

const router = express.Router();

router.get('/', getAllHuids);
router.put('/:huid/verify', verifyHuid);

export default router;


