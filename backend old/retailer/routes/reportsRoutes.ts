import express from 'express';
import { authMiddleware, roleMiddleware } from '../../lib/authUtils.js';
import { getProfitLoss } from '../controllers/reports/reportsController.js';
import { 
  getDailyClosingReport, 
  getSkuProfitLossReport, 
  getMakingChargesReport, 
  getDayBookReport, 
  getPaymentAgingReport, 
  getVendorOutstandingReport, 
  getCustomerCreditExposureReport,
  runBankReconciliation, 
  exportToTally, 
  exportToBusy, 
  downloadDataBackup,
  saveClosingDenomination,
  getClosingDenomination
} from '../controllers/reports/financialReportsController.js';
import { getVipCustomersReport, getBlacklistedCustomersReport } from '../controllers/reports/tierReportsController.js';

const router = express.Router();

// Profit & Loss core
router.get('/profit-loss', getProfitLoss);

// EOD Closing Cash & Gold Weights [Feature 123]
router.get('/daily-closing', getDailyClosingReport);
router.post('/daily-closing/denomination', saveClosingDenomination);
router.get('/daily-closing/denomination', getClosingDenomination);

// SKU-wise Profit & Loss margins [Feature 124]
router.get('/sku-pl', getSkuProfitLossReport);

// Making charges revenue totals [Feature 125]
router.get('/making-charges', getMakingChargesReport);

// Day book / cash book ledger statements [Feature 126]
router.get('/daybook', getDayBookReport);

const financeRoles = ["ADMIN", "STORE_MANAGER", "RETAILER", "CASHIER"];

// Outstanding payment aging directories [Feature 127]
router.get('/payment-aging', authMiddleware, roleMiddleware(financeRoles), getPaymentAgingReport);

// Customer credit exposure summary
router.get('/credit-exposure', authMiddleware, roleMiddleware(financeRoles), getCustomerCreditExposureReport);

// Vendor bullion balance ledger summaries [Feature 128]
router.get('/vendor-outstanding', authMiddleware, roleMiddleware(financeRoles), getVendorOutstandingReport);

// Bank statement reconciliation matching engine [Feature 129]
router.post('/bank-reconcile', runBankReconciliation);

// Software export compilations [Feature 131, 132]
router.post('/export/tally', exportToTally);
router.post('/export/busy', exportToBusy);

// VIP and Blacklisted Customer Reports [Feature 11]
router.get('/vip-customers', authMiddleware, roleMiddleware(financeRoles), getVipCustomersReport);
router.get('/blacklisted-customers', authMiddleware, roleMiddleware(financeRoles), getBlacklistedCustomersReport);

// Order Tracking Reports [Feature 12]
import { getOrderTrackingReport } from '../controllers/reports/orderTrackingReportController.js';
router.get('/order-tracking', authMiddleware, getOrderTrackingReport);

// Referral System Reports [Feature 13]
import { getReferralsReport, getReferralRewardsReport } from '../controllers/reports/referralsReportController.js';
router.get('/referrals', authMiddleware, getReferralsReport);
router.get('/referral-rewards', authMiddleware, getReferralRewardsReport);

// Making Charge Rules Reports [Feature 14]
import { getMakingChargeRulesReport, getMakingChargeUsageReport } from '../controllers/reports/makingChargeRulesReportController.js';
router.get('/making-charge-rules', authMiddleware, getMakingChargeRulesReport);
router.get('/making-charge-usage', authMiddleware, getMakingChargeUsageReport);

// Financial Year Reports [Feature 15]
import { getFinancialYearsReport, getYearClosingReport } from '../controllers/reports/financialYearReportController.js';
router.get('/financial-years', authMiddleware, getFinancialYearsReport);
router.get('/year-closing', authMiddleware, getYearClosingReport);

// Raw database table backups stream [Feature 133]
router.get('/backup/:table', downloadDataBackup);

export default router;



