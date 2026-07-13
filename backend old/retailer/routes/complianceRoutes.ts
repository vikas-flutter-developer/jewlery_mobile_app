import express from 'express';
import { 
  getGstSalesSummary, 
  registerEInvoice,
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
  getPmlaRegister
} from '../controllers/compliance/complianceController.js';
import huidRoutes from './huidRoutes.js';
import {
  getComplianceLogsHandler,
  getComplianceLogsByEntityHandler,
} from '../controllers/compliance/complianceLogController.js';

const router = express.Router();

// GST & GSTR Reporting
router.get('/gst/sales-summary', getGstSalesSummary);
router.get('/gst/gstr1', getGstr1Report);
router.get('/gst/gstr3b', getGstr3bSummary);
router.get('/gst/hsn-summary', getHsnWiseSummary);

// E-Way Bills
router.post('/einvoice/register', registerEInvoice);
router.post('/transfers/ewaybill', generateEWayBill);

// Anti-Money Laundering AML Audits
router.get('/aml/logs', getAmlLogs);

// RBI regulated Gold Loan evaluation pawn tracking
router.get('/gold-loans', getGoldLoans);
router.post('/gold-loans', createGoldLoan);
router.put('/gold-loans/:loanId/repay', repayGoldLoan);

// Form 60 & PMLA Statutory Register
router.post('/form60', createForm60);
router.get('/form60', getForm60Declarations);
router.get('/pmla-register', getPmlaRegister);

// Compliance Engine audit logs
router.get('/logs', getComplianceLogsHandler);
router.get('/logs/:entityId', getComplianceLogsByEntityHandler);

// HUID nested
router.use('/huid', huidRoutes);

export default router;



