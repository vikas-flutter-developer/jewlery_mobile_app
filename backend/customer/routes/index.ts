import express from 'express';
import portalRoutes from './portalRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import retailerOrdersRoutes from './retailerOrdersRoutes.js';
import offersRoutes from './offersRoutes.js';
import notificationsRoutes from './notificationsRoutes.js';
import crmRoutes from './crmRoutes.js';
import webhooksRoutes from './webhooksRoutes.js';
import accountsRoutes from './accountsRoutes.js';
import loyaltyRoutes from './loyaltyRoutes.js';
import ledgerRoutes from './ledgerRoutes.js';

const router = express.Router();

// Customer-specific modules
router.use('/portal', portalRoutes);
router.use('/catalog', catalogRoutes);
router.use('/retailer-orders', retailerOrdersRoutes);
router.use('/offers', offersRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/crm', crmRoutes);
router.use('/webhooks', webhooksRoutes);

// ─── New customer portal features ─────────────────────────────────────────────
router.use('/accounts', accountsRoutes);       // customer.customeraccounts  (MongoDB Atlas)
router.use('/loyalty', loyaltyRoutes);         // customer.customerloyaltypoints
router.use('/ledger', ledgerRoutes);           // customer.ledgerhistories

export default router;


