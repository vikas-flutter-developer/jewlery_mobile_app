import express from 'express';
import { getCustomerLoyalty } from '../controllers/crm/crmController.js';

const router = express.Router();

router.get('/loyalty/:customerId', getCustomerLoyalty);

export default router;


