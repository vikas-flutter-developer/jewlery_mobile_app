import express from "express";
import { getSettings, updateSettings } from "../controllers/settings/settingsController.js";
import {
  getInvoiceSeries,
  updateInvoiceSeries,
  getInvoiceProfileHandler,
  updateInvoiceProfileHandler,
} from "../../retailer/controllers/invoice/invoiceController.js";
import {
  createRule,
  updateRule,
  getRules,
  getRuleById,
  deleteRule,
  calculateMakingCharge
} from "../../retailer/controllers/settings/makingChargeRulesController.js";
import {
  createFinancialYear,
  updateFinancialYear,
  getFinancialYears,
  getFinancialYearById,
  activateFinancialYear,
  closeFinancialYear,
  getCurrentFinancialYearAPI
} from "../../retailer/controllers/settings/financialYearController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", getSettings);
router.put("/", updateSettings);

// ── Invoice Engine settings ──────────────────────────────────────────────────
// GET  /settings/invoice-series          – current series config & last sequence
// PUT  /settings/invoice-series          – update prefix / padLength / reset
// GET  /settings/invoice-profile         – shop profile used on invoices
// PUT  /settings/invoice-profile         – update shop profile
router.get("/invoice-series", getInvoiceSeries);
router.put("/invoice-series", updateInvoiceSeries);
router.get("/invoice-profile", getInvoiceProfileHandler);
router.put("/invoice-profile", updateInvoiceProfileHandler);

// ── Making Charge Rules settings ──────────────────────────────────────────────
router.post("/making-charge-rules", authMiddleware, createRule);
router.put("/making-charge-rules/:id", authMiddleware, updateRule);
router.get("/making-charge-rules", authMiddleware, getRules);
router.get("/making-charge-rules/:id", authMiddleware, getRuleById);
router.delete("/making-charge-rules/:id", authMiddleware, deleteRule);
router.post("/making-charge-rules/calculate", authMiddleware, calculateMakingCharge);

// ── Financial Year Management settings ─────────────────────────────────────────
router.post("/financial-years", authMiddleware, createFinancialYear);
router.get("/financial-years", authMiddleware, getFinancialYears);
router.get("/financial-years/current", authMiddleware, getCurrentFinancialYearAPI);
router.get("/financial-years/:id", authMiddleware, getFinancialYearById);
router.put("/financial-years/:id", authMiddleware, updateFinancialYear);
router.put("/financial-years/:id/activate", authMiddleware, activateFinancialYear);
router.put("/financial-years/:id/close", authMiddleware, closeFinancialYear);

export default router;

