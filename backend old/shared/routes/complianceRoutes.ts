import express from "express";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";
import {
  getHuidDashboard,
  getHuidProducts,
  getHuidSummary,
  getHuidExceptions,
  validateHuid
} from "../controllers/compliance/complianceController.js";
import {
  getGstDashboard,
  getGstSummary,
  getGstLiabilities,
  getGstExceptions,
  getGstFilingStatus,
} from "../controllers/compliance/gstComplianceController.js";

const router = express.Router();
const complianceRoles = ["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_ADMIN", "STORE_MANAGER"];
const gstRoles = ["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_ADMIN", "STORE_MANAGER", "ACCOUNTANT", "SALES"];

// ── HUID Compliance ──────────────────────────────────────────────────────────
router.get("/huid/dashboard", authMiddleware, roleMiddleware(complianceRoles), getHuidDashboard);
router.get("/huid/products", authMiddleware, roleMiddleware(complianceRoles), getHuidProducts);
router.get("/huid/summary", authMiddleware, roleMiddleware(complianceRoles), getHuidSummary);
router.get("/huid/exceptions", authMiddleware, roleMiddleware(complianceRoles), getHuidExceptions);
router.post("/huid/validate", authMiddleware, roleMiddleware(complianceRoles), validateHuid);

// ── GST Compliance ───────────────────────────────────────────────────────────
router.get("/gst/dashboard", authMiddleware, roleMiddleware(gstRoles), getGstDashboard);
router.get("/gst/summary", authMiddleware, roleMiddleware(gstRoles), getGstSummary);
router.get("/gst/liabilities", authMiddleware, roleMiddleware(gstRoles), getGstLiabilities);
router.get("/gst/exceptions", authMiddleware, roleMiddleware(gstRoles), getGstExceptions);
router.get("/gst/filing-status", authMiddleware, roleMiddleware(gstRoles), getGstFilingStatus);

export default router;
