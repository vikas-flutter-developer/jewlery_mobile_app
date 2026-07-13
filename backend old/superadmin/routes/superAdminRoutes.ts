import express from 'express';
import subscriptionRoutes from '../subscription/routes/subscriptionRoutes.js';
import {
  getSuperAdminMetrics,
  getSuperAdminStores,
  createSuperAdminStore,
  patchSuperAdminStore,
  deleteSuperAdminStore,
} from '../controllers/stores/storesController.js';
import {
  getSuperAdminDemoAccess,
  updateSuperAdminDemoAccess,
  getSuperAdminAuditLogs,
  getSuperAdminInvoices,
  createSuperAdminInvoice,
} from '../controllers/platform/platformController.js';
import {
  getSuperAdminUsers,
  getSuperAdminStockAnalytics,
} from '../controllers/users/usersController.js';

const router = express.Router();

router.get('/metrics', getSuperAdminMetrics);
router.get('/stores', getSuperAdminStores);
router.post('/stores', createSuperAdminStore);
router.patch('/stores/:id', patchSuperAdminStore);
router.delete('/stores/:id', deleteSuperAdminStore);
router.get('/demo-access', getSuperAdminDemoAccess);
router.put('/demo-access', updateSuperAdminDemoAccess);
// Removed platform feature-flags and announcements endpoints per request
router.get('/audit', getSuperAdminAuditLogs);
router.get('/invoices', getSuperAdminInvoices);
router.post('/invoices', createSuperAdminInvoice);
router.get('/users', getSuperAdminUsers);
router.get('/stock-analytics', getSuperAdminStockAnalytics);

// ── SaaS Subscription Module ─────────────────────────────────────────────────
// Mounts: /plans, /stores/:id/payments, /stores/:id/plan, /stores/:id/suspend,
//         /stores/:id/reactivate, /stores/:id/trial, /feature-flags
router.use('/', subscriptionRoutes);

export default router;
