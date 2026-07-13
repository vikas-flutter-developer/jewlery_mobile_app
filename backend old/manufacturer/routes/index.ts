import express from 'express';
import { authMiddleware, roleMiddleware } from '../../lib/authUtils.js';
import { getMySupportTickets, createSupportTicket } from '../../shared/controllers/support/supportController.js';
import paymentsRoutes from '../../retailer/routes/paymentsRoutes.js';

// ── Cross-role shared controllers (delegated from retailer layer) ──────────────
import {
  getGstr1Report,
  getGstr3bSummary,
  getHsnWiseSummary,
  generateEWayBill,
  getAmlLogs,
  getGoldLoans,
  createGoldLoan,
  repayGoldLoan,
  createForm60,
  getForm60Declarations,
  getPmlaRegister,
} from '../../retailer/controllers/compliance/complianceController.js';

import {
  getSalesByCategory,
  getTopSellingItems,
  getBestCustomersByValue,
  getHourlySalesHeatmap,
  getMetalRateCorrelation,
  getKarikarEfficiency,
} from '../../retailer/controllers/dashboards/analyticsController.js';

import {
  getConsolidatedDashboard,
  getPLComparison,
  getGSTFiling,
} from '../../retailer/controllers/branches/branchController.js';

import {
  getBranchTransfers,
  createBranchTransfer,
  approveBranchTransfer,
  rejectBranchTransfer,
  receiveBranchTransfer,
} from '../../retailer/controllers/branches/branchTransfersController.js';

import {
  reconcileInventory,
  getConsignmentStock,
  createConsignmentStock,
  updateConsignmentStock,
} from '../../retailer/controllers/inventory/inventoryController.js';

// ── POS (billing, invoices, cheques) ──────────────────────────────────────────
import {
  createPosInvoice,
  estimatePosBilling,
  holdPosInvoice,
  getCheques,
  createCheque,
  updateChequeStatus,
} from '../../retailer/controllers/pos/posEstimateController.js';
import {
  postAdvanceDeposit,
  getAdvanceDeposit,
  postEmiPlan,
  getEmiByInvoice,
  postPayEmiInstallment,
  getEmiInstallmentsList,
  postRefundPayment,
  postReversePayment,
  postCollectInvoicePayment,
} from '../../retailer/controllers/pos/posFinancialController.js';

// ── Live Rates (IBJA feed, delete) ────────────────────────────────────────────
import {
  getLiveRates,
  importIbjaRates,
  deleteRate,
} from '../../retailer/controllers/rates/liveRatesController.js';

// ── Full Financial Reports ─────────────────────────────────────────────────────
import {
  getDailyClosingReport,
  getSkuProfitLossReport,
  getMakingChargesReport,
  getDayBookReport,
  getPaymentAgingReport,
  getVendorOutstandingReport,
  runBankReconciliation,
  exportToTally,
  exportToBusy,
  downloadDataBackup,
  saveClosingDenomination,
  getClosingDenomination,
} from '../../retailer/controllers/reports/financialReportsController.js';

// ── Advanced Customer CRM ──────────────────────────────────────────────────────
import {
  getCustomerCelebrations,
  getCustomerTimeline,
  getReactivationList,
  sendMarketingCampaignBlast,
  getReferralNetwork,
  getQuotations,
  createQuotation,
  updateQuotationStatus,
} from '../../retailer/controllers/customers/advancedCustomersController.js';

import {
  uploadCustomerKyc,
} from '../../retailer/controllers/customers/customersController.js';

// ── Staff HR Extended (shift, attendance, performance, schedules) ──────────────
import {
  clockShift,
  getAllAttendance,
  getStaffPerformance,
  getUserSchedule,
  updateUserSchedule,
} from '../../shared/controllers/users/usersController.js';

// ── Catalog Extensions (wishlist, location, alerts, reports) ──────────────────
import {
  getWishlists,
  addToWishlist,
  removeFromWishlist,
  updateItemLocation,
  getLowStockAlerts,
  getDeadStockReport,
  getItemAgingReport,
} from '../../customer/controllers/catalog/catalogController.js';

import {
  getManufacturerBranches,
  createManufacturerBranch,
  updateManufacturerBranch
} from '../controllers/branches/branchesController.js';

import {
  getManufacturerInventory,
  createManufacturerInventory,
  updateManufacturerInventory,
  getManufacturerAdvancedInventory,
  verifyManufacturerHuid,
  getManufacturerHuidRecords,
  createManufacturerPurchaseInward
} from '../controllers/inventory/inventoryController.js';

import {
  getManufacturerBarcodes,
  createManufacturerBarcode,
  getManufacturerBarcodeByCode
} from '../controllers/barcodes/barcodesController.js';

import {
  getManufacturerDesigns,
  createManufacturerDesign,
  deleteManufacturerDesign,
  getManufacturerGemstoneParcels,
  createManufacturerGemstoneParcel,
  issueManufacturerGemstones
} from '../controllers/catalog/catalogController.js';

import {
  getManufacturerRates,
  createManufacturerRate,
  updateManufacturerRate,
  deleteManufacturerRate,
  getManufacturerVendors,
  createManufacturerVendor,
  updateManufacturerVendor,
  deleteManufacturerVendor,
  getManufacturerKarikars,
  createManufacturerKarikar,
  updateManufacturerKarikar,
  deleteManufacturerKarikar,
  recordManufacturerKarikarMetalReturn,
  getManufacturerKarikarSelfService
} from '../controllers/vendors/vendorsController.js';

import {
  getManufacturerOrders,
  createManufacturerOrder,
  updateManufacturerOrder,
  deleteManufacturerOrder,
  getManufacturerRetailerOrders,
  createManufacturerRetailerOrder,
  updateManufacturerRetailerOrderStatus,
  getManufacturerSales,
  createManufacturerSale,
  getManufacturerWholesaleOrders,
  createManufacturerWholesaleChallan,
  createManufacturerWholesaleInvoice,
  deleteManufacturerWholesaleOrder,
  updateManufacturerWholesaleOrderStatus
} from '../controllers/orders/ordersController.js';

import {
  createMoodboard,
  getMoodboards,
  updateMoodboard,
  deleteMoodboard,
  logImageDownload,
} from '../controllers/orders/moodboardController.js';

import {
  getManufacturerSchemeDefinitions,
  createManufacturerSchemeDefinition,
  updateManufacturerSchemeDefinition,
  getManufacturerSchemeEnrollments,
  createManufacturerSchemeEnrollment,
  recordManufacturerSchemeInstallment,
  getManufacturerSchemeMaturityList,
  getManufacturerSchemeDefaulters,
  redeemManufacturerScheme
} from '../controllers/schemes/schemesController.js';

import {
  getManufacturerOldGoldExchanges,
  createManufacturerOldGoldExchange,
  getManufacturerReturns,
  createManufacturerReturn,
  updateManufacturerReturnRefund,
  createManufacturerExchange,
  getManufacturerExchanges,
  getManufacturerReturnReasonsReport,
  getManufacturerAvailableInvoices
} from '../controllers/returns/returnsController.js';
// Retailer old-gold controllers (mounted as aliases for admin routes)
import {
  createOldGoldPurchase,
  listOldGoldStock,
  createOldGoldDeduction,
  issueOldGoldToKarikar,
  createMeltingLog,
  getOldGoldPurchases,
  getMeltingLogs,
} from '../../retailer/controllers/oldgold/oldGoldController.js';

import {
  postManufacturerJournal,
  getManufacturerTrialBalance,
  getManufacturerKhata,
  addManufacturerKhataEntry,
  updateManufacturerKhata
} from '../controllers/accounting/accountingController.js';

import {
  getManufacturerComplianceRecords,
  createManufacturerComplianceRecord,
  getManufacturerHallmarkBatches,
  createManufacturerHallmarkBatch,
  getManufacturerOffers,
  createManufacturerOffer,
  validateManufacturerOffer,
  deleteManufacturerOffer
} from '../controllers/compliance/complianceController.js';

import {
  getManufacturerReportsSummary,
  getManufacturerDashboard
} from '../controllers/reports/reportsController.js';

import {
  getManufacturerUsers,
  createManufacturerUser,
  deleteManufacturerUser
} from '../controllers/users/usersController.js';

import {
  getManufacturerSubscriptions,
  createManufacturerSubscription,
  updateManufacturerSubscription
} from '../controllers/subscriptions/subscriptionsController.js';

import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from '../controllers/purchases/purchasesController.js';

const router = express.Router();

// Manufacturer branch management
router.get('/branches', getManufacturerBranches);
router.post('/branches', createManufacturerBranch);
router.put('/branches/:id', updateManufacturerBranch);

// Branch transfers & consolidated reports
router.get('/branches/transfers', getBranchTransfers);
router.post('/branches/transfers', createBranchTransfer);
router.put('/branches/transfers/:transferId/approve', approveBranchTransfer);
router.put('/branches/transfers/:transferId/reject', rejectBranchTransfer);
router.put('/branches/transfers/:transferId/receive', receiveBranchTransfer);
router.get('/branches/reports/consolidated', getConsolidatedDashboard);
router.get('/branches/reports/pl-comparison', getPLComparison);
router.get('/branches/reports/gst-filing', getGSTFiling);

// Manufacturer inventory
router.get('/inventory', getManufacturerInventory);
router.post('/inventory', createManufacturerInventory);
router.put('/inventory/:id', updateManufacturerInventory);
router.get('/inventory/advanced', getManufacturerAdvancedInventory);
router.post('/inventory/reconcile', reconcileInventory);
router.get('/inventory/consignment', getConsignmentStock);
router.post('/inventory/consignment', createConsignmentStock);
router.put('/inventory/consignment/:id', updateConsignmentStock);

// Manufacturer barcode management
router.get('/barcodes', getManufacturerBarcodes);
router.post('/barcodes', createManufacturerBarcode);
router.get('/barcodes/:code', getManufacturerBarcodeByCode);

// Manufacturer catalog
router.get('/catalog/designs', getManufacturerDesigns);
router.post('/catalog/designs', createManufacturerDesign);
router.delete('/catalog/designs/:id', deleteManufacturerDesign);

// Manufacturer gemstones
router.get('/gemstones/parcels', getManufacturerGemstoneParcels);
router.post('/gemstones/parcels', createManufacturerGemstoneParcel);
router.post('/gemstones/issue', issueManufacturerGemstones);

// Manufacturer rate management
router.get('/rates', getManufacturerRates);
router.post('/rates', createManufacturerRate);
router.put('/rates/:metal', updateManufacturerRate);

// Manufacturer vendors
router.get('/vendors', getManufacturerVendors);
router.post('/vendors', createManufacturerVendor);
router.put('/vendors/:id', updateManufacturerVendor);
router.delete('/vendors/:id', deleteManufacturerVendor);

// Manufacturer karikar onboarding
router.get('/karikars', getManufacturerKarikars);
router.post('/karikars', createManufacturerKarikar);
router.put('/karikars/:id', updateManufacturerKarikar);
router.delete('/karikars/:id', deleteManufacturerKarikar);
router.post('/karikars/:id/returns', recordManufacturerKarikarMetalReturn);
router.get('/karikars/:id/self-service', getManufacturerKarikarSelfService);

// Manufacturer orders and billing
router.get('/orders', getManufacturerOrders);
router.post('/orders', createManufacturerOrder);
router.put('/orders/:id', updateManufacturerOrder);
router.delete('/orders/:id', deleteManufacturerOrder);

// ─── Manufacturer Moodboard endpoints (mirrors retailer's ordersRoutes.ts) ────
router.post('/orders/:orderId/moodboard', authMiddleware, createMoodboard);
router.get('/orders/:orderId/moodboard', authMiddleware, getMoodboards);
router.put('/orders/:orderId/moodboard/:moodboardId', authMiddleware, updateMoodboard);
router.delete('/orders/:orderId/moodboard/:moodboardId', authMiddleware, deleteMoodboard);
router.post('/orders/:orderId/moodboard/:moodboardId/download-log', authMiddleware, logImageDownload);

router.get('/retailer-orders', authMiddleware, getManufacturerRetailerOrders);
router.post('/retailer-orders', authMiddleware, createManufacturerRetailerOrder);
router.put('/retailer-orders/:id', authMiddleware, updateManufacturerRetailerOrderStatus);
router.get('/sales', getManufacturerSales);
router.post('/sales', createManufacturerSale);

// Manufacturer customer care support ticket routes
router.get('/support/tickets', authMiddleware, roleMiddleware(['MANUFACTURER']), getMySupportTickets);
router.post('/support/tickets', authMiddleware, roleMiddleware(['MANUFACTURER']), createSupportTicket);

// Manufacturer wholesale and purchase flows
router.get('/wholesale', getManufacturerWholesaleOrders);
router.post('/wholesale/challan', createManufacturerWholesaleChallan);
router.post('/wholesale/invoice', createManufacturerWholesaleInvoice);
router.delete('/wholesale/:id', deleteManufacturerWholesaleOrder);
router.put('/wholesale/:id/status', updateManufacturerWholesaleOrderStatus);
router.post('/purchases/inward', createManufacturerPurchaseInward);

// Purchase Register (full CRUD)
router.get('/purchase-orders', getPurchaseOrders);
router.post('/purchase-orders', createPurchaseOrder);
router.put('/purchase-orders/:id', updatePurchaseOrder);
router.delete('/purchase-orders/:id', deletePurchaseOrder);

// Manufacturer schemes
router.get('/schemes', getManufacturerSchemeDefinitions);
router.post('/schemes', createManufacturerSchemeDefinition);
router.put('/schemes/:id', updateManufacturerSchemeDefinition);
router.get('/schemes/enrollments', getManufacturerSchemeEnrollments);
router.post('/schemes/enroll', createManufacturerSchemeEnrollment);
router.post('/schemes/enrollments/:id/installments', recordManufacturerSchemeInstallment);
router.get('/schemes/maturity', getManufacturerSchemeMaturityList);
router.get('/schemes/defaulters', getManufacturerSchemeDefaulters);
router.post('/schemes/enrollments/:id/redeem', redeemManufacturerScheme);

// Manufacturer old gold and exchange
router.get('/old-gold', getManufacturerOldGoldExchanges);
router.post('/old-gold/exchange', createManufacturerOldGoldExchange);
// Backwards-compatible alias and extra endpoints expected by frontend when prefixed with /manufacturer
router.get('/oldgold', getManufacturerOldGoldExchanges);
router.post('/oldgold/exchange', createManufacturerOldGoldExchange);
router.post('/oldgold/purchases', createOldGoldPurchase);
router.get('/oldgold/purchases', getOldGoldPurchases);
router.get('/oldgold/stock', listOldGoldStock);
router.post('/oldgold/deduct', createOldGoldDeduction);
router.post('/oldgold/issue', issueOldGoldToKarikar);
router.post('/oldgold/melting', createMeltingLog);
router.get('/oldgold/melting', getMeltingLogs);

// Manufacturer returns and refund
router.get('/returns/sales', getManufacturerReturns);
router.post('/returns/sales', createManufacturerReturn);
router.patch('/returns/sales/:returnId/refund', updateManufacturerReturnRefund);
router.post('/returns/exchange', createManufacturerExchange);
router.get('/returns/exchange', getManufacturerExchanges);
router.get('/returns/reasons-report', getManufacturerReturnReasonsReport);
router.get('/returns/invoices', getManufacturerAvailableInvoices);

// Manufacturer accounting and khata
router.post('/accounting/journal', postManufacturerJournal);
router.get('/accounting/trial-balance', getManufacturerTrialBalance);
router.get('/khata', getManufacturerKhata);
router.post('/khata', addManufacturerKhataEntry);
router.put('/khata/:id', updateManufacturerKhata);

// Manufacturer compliance, HUID, hallmarking, offers
router.get('/compliance', getManufacturerComplianceRecords);
router.post('/compliance', createManufacturerComplianceRecord);
// GST compliance sub-routes
router.get('/compliance/gst', getGstr1Report);         // Flutter app compatibility alias
router.get('/compliance/gst/gstr1', getGstr1Report);
router.get('/compliance/gst/gstr3b', getGstr3bSummary);
router.get('/compliance/gst/hsn-summary', getHsnWiseSummary);
router.post('/compliance/transfers/ewaybill', generateEWayBill);
// AML, Gold Loans, PMLA, Form 60
router.get('/compliance/aml/logs', getAmlLogs);
router.get('/compliance/gold-loans', getGoldLoans);
router.post('/compliance/gold-loans', createGoldLoan);
router.put('/compliance/gold-loans/:loanId/repay', repayGoldLoan);
router.post('/compliance/form60', createForm60);
router.get('/compliance/form60', getForm60Declarations);
router.get('/compliance/pmla-register', getPmlaRegister);
// HUID & Hallmarking
router.get('/huid', getManufacturerHuidRecords);
router.get('/huid/:huid', verifyManufacturerHuid);
router.get('/hallmarking/batches', getManufacturerHallmarkBatches);
router.post('/hallmarking/batches', createManufacturerHallmarkBatch);
// Offers — with validate and delete
router.get('/offers', getManufacturerOffers);
router.post('/offers', createManufacturerOffer);
router.get('/offers/validate/:code', validateManufacturerOffer);
router.delete('/offers/:id', deleteManufacturerOffer);

// Manufacturer reports and user role management
router.get('/reports/summary', getManufacturerReportsSummary);
router.get('/users', getManufacturerUsers);
router.post('/users', createManufacturerUser);
router.delete('/users/:id', deleteManufacturerUser);

// ── Staff HR Extended ─────────────────────────────────────────────────────────
router.post('/users/:id/shift', clockShift);              // clock-in / clock-out
router.get('/users/attendance', getAllAttendance);         // attendance register
router.get('/users/performance', getStaffPerformance);    // performance metrics
router.get('/users/:id/schedule', getUserSchedule);       // shift schedule GET
router.put('/users/:id/schedule', updateUserSchedule);    // shift schedule PUT

// ── Rates — live feed, IBJA import, delete ────────────────────────────────────
router.get('/rates/live', getLiveRates);
router.post('/rates/import', importIbjaRates);
router.delete('/rates/:id', deleteManufacturerRate);

// ── POS — billing, invoices, cheques ─────────────────────────────────────────
router.post('/pos/estimate', estimatePosBilling);
router.post('/pos/invoices', createPosInvoice);
router.post('/pos/invoices/:id/hold', holdPosInvoice);
router.post('/pos/advance-deposit', postAdvanceDeposit);
router.get('/pos/advance-deposit/:customerId', getAdvanceDeposit);
router.post('/pos/emi-plans', postEmiPlan);
router.post('/pos/emi/:emiId/pay', postPayEmiInstallment);
router.get('/pos/emi/:emiId/installments', getEmiInstallmentsList);
router.get('/pos/emi/:invoiceId', getEmiByInvoice);
router.post('/pos/payments/refund', postRefundPayment);
router.post('/pos/payments/reverse', postReversePayment);
router.post('/pos/invoices/:invoiceId/collect-payment', postCollectInvoicePayment);
router.get('/pos/cheques', getCheques);
router.post('/pos/cheques', createCheque);
router.patch('/pos/cheques/:id', updateChequeStatus);

// ── Full Financial Reports ────────────────────────────────────────────────────
router.get('/reports/daily-closing', getDailyClosingReport);
router.post('/reports/daily-closing/denomination', saveClosingDenomination);
router.get('/reports/daily-closing/denomination', getClosingDenomination);
router.get('/reports/sku-pl', getSkuProfitLossReport);
router.get('/reports/making-charges', getMakingChargesReport);
router.get('/reports/daybook', getDayBookReport);
router.get('/reports/payment-aging', getPaymentAgingReport);
router.get('/reports/vendor-outstanding', getVendorOutstandingReport);
router.post('/reports/bank-reconcile', runBankReconciliation);
router.post('/reports/export/tally', exportToTally);
router.post('/reports/export/busy', exportToBusy);
router.get('/reports/backup/:table', downloadDataBackup);

// ── Advanced Customer CRM ─────────────────────────────────────────────────────
router.get('/customers/celebrations', getCustomerCelebrations);
router.get('/customers/reactivation', getReactivationList);
router.get('/customers/referrals', getReferralNetwork);
router.get('/customers/quotes', getQuotations);
router.post('/customers/quotes', createQuotation);
router.put('/customers/quotes/:quoteId', updateQuotationStatus);
router.post('/customers/campaign/blast', sendMarketingCampaignBlast);
router.get('/customers/:id/timeline', getCustomerTimeline);
router.post('/customers/:id/kyc', uploadCustomerKyc);

// ── Catalog Extensions ────────────────────────────────────────────────────────
router.get('/catalog/wishlist', getWishlists);
router.post('/catalog/wishlist', addToWishlist);
router.delete('/catalog/wishlist/:id', removeFromWishlist);
router.put('/catalog/inventory/:barcode/location', updateItemLocation);
router.get('/catalog/alerts/low-stock', getLowStockAlerts);
router.get('/catalog/reports/dead-stock', getDeadStockReport);
router.get('/catalog/reports/aging', getItemAgingReport);

// Dashboard, analytics and subscriptions
router.get('/dashboard', getManufacturerDashboard);
router.get('/dashboard/analytics/sales-by-category', getSalesByCategory);
router.get('/dashboard/analytics/top-selling-items', getTopSellingItems);
router.get('/dashboard/analytics/best-customers', getBestCustomersByValue);
router.get('/dashboard/analytics/hourly-heatmap', getHourlySalesHeatmap);
router.get('/dashboard/analytics/metal-rate-correlation', getMetalRateCorrelation);
router.get('/dashboard/analytics/karikar-efficiency', getKarikarEfficiency);
router.get('/subscriptions', getManufacturerSubscriptions);
router.post('/subscriptions', createManufacturerSubscription);
router.put('/subscriptions/:id', updateManufacturerSubscription);
router.use('/payments', paymentsRoutes);

export default router;

