import express from "express";
import {
  getCommissions,
  getCommissionById,
  calculateCommission,
  approveCommission,
  cancelCommission,
  getCommissionsSummary
} from "../controllers/referrals/referralCommissionController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getCommissions);
router.get("/summary", authMiddleware, getCommissionsSummary);
router.get("/:id", authMiddleware, getCommissionById);
router.post("/calculate", authMiddleware, calculateCommission);
router.put("/:id/approve", authMiddleware, approveCommission);
router.put("/:id/cancel", authMiddleware, cancelCommission);

export default router;
