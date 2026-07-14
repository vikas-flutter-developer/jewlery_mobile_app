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
import {
  getPlatformDashboard,
  getPlatformUsers,
  getPlatformStores,
  getPlatformActivity,
  getPlatformSummary
} from '../controllers/platform/platformAnalyticsController.js';
import { getPlatformAnalyticsReport } from '../controllers/platform/platformAnalyticsReportController.js';
import {
  getSubscriptionDashboard,
  getSubscriptionPlans,
  getSubscriptionRevenue,
  getSubscriptionChurn,
  getSubscriptionSummary
} from '../controllers/platform/subscriptionAnalyticsController.js';
import {
  getSubscriptionAnalyticsReport,
  getSubscriptionRevenueReport,
  getSubscriptionChurnReport
} from '../controllers/platform/subscriptionAnalyticsReportController.js';

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

// Platform Analytics Routes
router.get('/platform-analytics/dashboard', getPlatformDashboard);
router.get('/platform-analytics/users', getPlatformUsers);
router.get('/platform-analytics/stores', getPlatformStores);
router.get('/platform-analytics/activity', getPlatformActivity);
router.get('/platform-analytics/summary', getPlatformSummary);
router.get('/platform-analytics/report', getPlatformAnalyticsReport);

// Subscription Analytics Routes
router.get('/subscription-analytics/dashboard', getSubscriptionDashboard);
router.get('/subscription-analytics/plans', getSubscriptionPlans);
router.get('/subscription-analytics/revenue', getSubscriptionRevenue);
router.get('/subscription-analytics/churn', getSubscriptionChurn);
router.get('/subscription-analytics/summary', getSubscriptionSummary);
router.get('/subscription-analytics/report', getSubscriptionAnalyticsReport);
router.get('/subscription-analytics/report/revenue', getSubscriptionRevenueReport);
router.get('/subscription-analytics/report/churn', getSubscriptionChurnReport);

// ── SaaS Subscription Module ─────────────────────────────────────────────────
// Mounts: /plans, /stores/:id/payments, /stores/:id/plan, /stores/:id/suspend,
//         /stores/:id/reactivate, /stores/:id/trial, /feature-flags
router.use('/', subscriptionRoutes);

export default router;
