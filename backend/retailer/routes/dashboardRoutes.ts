import express from 'express';
import {
  getAccountantDashboard,
  getAccountingKhata,
  getAuditLogs,
} from '../controllers/dashboards/accountantDashboardController.js';
import {
  getKarikarDashboard,
  getKarikarManagement,
  getKarikarReturns,
  getKarikarReturnSummary,
  listKarikarWastageReconciliations,
  getWastageReconciliationSummary,
  approveWastageReconciliation,
  rejectWastageReconciliation,
  listKarikarWageLedgers,
  getKarikarWageLedgerSummary,
  approveKarikarWageLedger,
  rejectKarikarWageLedger,
  payKarikarWageLedger,
  assignJobToKarikar,
  updateKarikarStatus,
} from '../controllers/dashboards/karikarDashboardController.js';
import { authMiddleware } from '../../lib/authUtils.js';
import {
  getSalesDashboard,
  getSalesManagement,
  getOrderManagement,
  getOfferManagement,
  getCustomerManagement,
  createSale,
} from '../controllers/dashboards/salesDashboardController.js';
import { getAdminDashboard } from '../controllers/dashboards/adminDashboardController.js';
import {
  getSalesByCategory,
  getTopSellingItems,
  getBestCustomersByValue,
  getHourlySalesHeatmap,
  getMetalRateCorrelation,
  getKarikarEfficiency,
} from '../controllers/dashboards/analyticsController.js';

const router = express.Router();

// Admin Dashboard Routes
router.get('/admin', getAdminDashboard);

// Accountant Dashboard Routes
router.get('/accountant', getAccountantDashboard);
router.get('/accountant/khata', getAccountingKhata);
router.get('/accountant/audit-logs', getAuditLogs);

// Karikar Dashboard Routes
router.get('/karikar', getKarikarDashboard);
router.get('/karikar/management', getKarikarManagement);
router.get('/karikar/returns', getKarikarReturns);
router.get('/karikar/returns/summary', getKarikarReturnSummary);
router.get('/karikar/wastage-reconciliations', authMiddleware, listKarikarWastageReconciliations);
router.get('/karikar/wastage-reconciliations/summary', authMiddleware, getWastageReconciliationSummary);
router.post('/karikar/wastage-reconciliations/:reconciliationId/approve', authMiddleware, approveWastageReconciliation);
router.post('/karikar/wastage-reconciliations/:reconciliationId/reject', authMiddleware, rejectWastageReconciliation);
router.get('/karikar/wage-ledgers', authMiddleware, listKarikarWageLedgers);
router.get('/karikar/wage-ledgers/summary', authMiddleware, getKarikarWageLedgerSummary);
router.post('/karikar/wage-ledgers/:ledgerId/approve', authMiddleware, approveKarikarWageLedger);
router.post('/karikar/wage-ledgers/:ledgerId/reject', authMiddleware, rejectKarikarWageLedger);
router.post('/karikar/wage-ledgers/:ledgerId/pay', authMiddleware, payKarikarWageLedger);
router.post('/karikar/assign-job', assignJobToKarikar);
router.patch('/karikar/:karikarId/status', updateKarikarStatus);

// Sales Dashboard Routes
router.get('/sales', getSalesDashboard);
router.get('/sales/management', getSalesManagement);
router.get('/sales/orders', getOrderManagement);
router.get('/sales/offers', getOfferManagement);
router.get('/sales/customers', getCustomerManagement);
router.post('/sales/create', createSale);

// Advanced Analytics (Features 186-191)
router.get('/analytics/sales-by-category', getSalesByCategory);
router.get('/analytics/top-selling-items', getTopSellingItems);
router.get('/analytics/best-customers', getBestCustomersByValue);
router.get('/analytics/hourly-heatmap', getHourlySalesHeatmap);
router.get('/analytics/metal-rate-correlation', getMetalRateCorrelation);
router.get('/analytics/karikar-efficiency', getKarikarEfficiency);

export default router;


