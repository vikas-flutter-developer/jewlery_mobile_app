import express from 'express';
import { getTrialBalance, postJournal } from '../controllers/accounting/accountingController.js';

const router = express.Router();

router.post('/journal', postJournal);
router.get('/trial-balance', getTrialBalance);

export default router;


