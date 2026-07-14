import express from "express";
import {
  getRules,
  getRuleById,
  createRule,
  updateRule,
  activateRule,
  deactivateRule,
  getRulesSummary
} from "../controllers/vendors/vendorRateRuleController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getRules);
router.get("/summary", authMiddleware, getRulesSummary);
router.get("/:id", authMiddleware, getRuleById);
router.post("/", authMiddleware, createRule);
router.put("/:id", authMiddleware, updateRule);
router.put("/:id/activate", authMiddleware, activateRule);
router.put("/:id/deactivate", authMiddleware, deactivateRule);

export default router;
