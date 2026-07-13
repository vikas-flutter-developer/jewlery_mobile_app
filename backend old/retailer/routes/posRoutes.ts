import express from "express";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";
import { 
  createPosInvoice, 
  estimatePosBilling, 
  holdPosInvoice, 
  cancelPosInvoice,
  getCheques,
  createCheque,
  updateChequeStatus
} from "../controllers/pos/posEstimateController.js";
import invoiceRoutes from "./invoiceRoutes.js";
import {
  postAdvanceDeposit,
  getAdvanceDeposit,
  postEmiPlan,
  getEmiByInvoice,
  postPayEmiInstallment,
  getEmiInstallmentsList,
  postProcessPayments,
  postCollectInvoicePayment,
  postRefundPayment,
  postReversePayment,
  getPaymentHistory,
} from "../controllers/pos/posFinancialController.js";

const router = express.Router();
const financeRoles = ["ADMIN", "STORE_MANAGER", "RETAILER", "CASHIER"];
const financeGuard = [authMiddleware, roleMiddleware(financeRoles)];

router.post("/estimate", estimatePosBilling);
router.post("/invoices", createPosInvoice);
router.post("/invoices/:id/hold", holdPosInvoice);
router.post("/invoices/:id/cancel", cancelPosInvoice);

// POS Financial Engine
router.post("/advance-deposit", ...financeGuard, postAdvanceDeposit);
router.get("/advance-deposit/:customerId", ...financeGuard, getAdvanceDeposit);
router.post("/emi-plans", ...financeGuard, postEmiPlan);
router.post("/emi/:emiId/pay", ...financeGuard, postPayEmiInstallment);
router.get("/emi/:emiId/installments", ...financeGuard, getEmiInstallmentsList);
router.get("/emi/:invoiceId", ...financeGuard, getEmiByInvoice);
router.post("/payments", ...financeGuard, postProcessPayments);
router.post("/payments/refund", ...financeGuard, postRefundPayment);
router.post("/payments/reverse", ...financeGuard, postReversePayment);
router.get("/payments/history", ...financeGuard, getPaymentHistory);
router.post("/invoices/:invoiceId/collect-payment", ...financeGuard, postCollectInvoicePayment);

// Feature 161: Cheque & EMI Repayment Desk routes
router.get("/cheques", getCheques);
router.post("/cheques", createCheque);
router.patch("/cheques/:id", updateChequeStatus);

// ── Invoice Engine routes ────────────────────────────────────────────────────
// GET  /pos/invoices                   – list all invoices
// GET  /pos/invoices/:id/pdf           – A4 GST PDF download
// GET  /pos/invoices/:id/thermal       – Thermal PDF (?width=58|80)
// POST /pos/receipts/advance           – Advance receipt
router.use("/", invoiceRoutes);

export default router;


