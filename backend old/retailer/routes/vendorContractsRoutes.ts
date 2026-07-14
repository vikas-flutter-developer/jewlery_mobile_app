import express from "express";
import {
  getContracts,
  getContractById,
  createContract,
  updateContract,
  activateContract,
  cancelContract,
  getContractsSummary,
  updateContractStatus
} from "../controllers/vendors/vendorContractController.js";
import {
  resolvePriceHandler,
  getPriceHistory
} from "../controllers/vendors/contractPriceResolutionController.js";
import {
  getExpiringContractsHandler,
  getExpirySummaryHandler,
  checkExpiryHandler
} from "../controllers/vendors/contractExpiryController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

// ── Expiry Alerts (MUST be before /:id to avoid route shadowing) ──────
router.get("/expiring", authMiddleware, getExpiringContractsHandler);
router.get("/expiry-summary", authMiddleware, getExpirySummaryHandler);
router.post("/check-expiry", authMiddleware, checkExpiryHandler);

// ── Price Resolution Engine ───────────────────────────────────────────
router.post("/resolve-price", authMiddleware, resolvePriceHandler);
router.get("/price-history", authMiddleware, getPriceHistory);

// ── Vendor Contract CRUD ──────────────────────────────────────────────
router.get("/", authMiddleware, getContracts);
router.get("/summary", authMiddleware, getContractsSummary);
router.get("/:id", authMiddleware, getContractById);
router.post("/", authMiddleware, createContract);
router.put("/:id", authMiddleware, updateContract);
router.put("/:id/activate", authMiddleware, activateContract);
router.put("/:id/cancel", authMiddleware, cancelContract);
router.put("/:id/status", authMiddleware, updateContractStatus);

export default router;
