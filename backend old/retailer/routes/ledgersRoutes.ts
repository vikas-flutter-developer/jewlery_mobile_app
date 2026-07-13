import express from 'express';
import { getLedgerByAccount } from '../controllers/ledgers/ledgersController.js';

const router = express.Router();

router.get('/:accountId', getLedgerByAccount);

export default router;


