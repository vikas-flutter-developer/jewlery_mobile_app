import express from "express";
import {
  getPayouts,
  getPayoutById,
  createPayout,
  processPayment,
  getPayoutsSummary
} from "../controllers/referrals/referralPayoutController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getPayouts);
router.get("/summary", authMiddleware, getPayoutsSummary);
router.get("/:id", authMiddleware, getPayoutById);
router.post("/", authMiddleware, createPayout);
router.put("/:id/pay", authMiddleware, processPayment);

export default router;
