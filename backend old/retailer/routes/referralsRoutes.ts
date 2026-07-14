import express from "express";
import {
  generateReferralCode,
  registerReferral,
  getMyReferrals,
  getMyRewards,
  getReferralSummary,
  processReferralReward
} from "../controllers/referrals/referralsController.js";
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  convertLead,
  getLeadsSummary
} from "../controllers/referrals/referralLeadController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

// Customer referrals
router.post("/generate-code", authMiddleware, generateReferralCode);
router.post("/register", authMiddleware, registerReferral);
router.get("/my-referrals", authMiddleware, getMyReferrals);
router.get("/my-rewards", authMiddleware, getMyRewards);
router.post("/reward", authMiddleware, processReferralReward);

// Dynamic Summary Overload
router.get("/summary", authMiddleware, async (req: any, res: any) => {
  console.log("Summary Route req.user:", req.user);
  if (req.user?.role?.toUpperCase() === "CUSTOMER") {
    return getReferralSummary(req, res);
  } else {
    return getLeadsSummary(req, res);
  }
});

// Lead tracking admin routes
router.get("/", authMiddleware, getLeads);
router.post("/", authMiddleware, createLead);
router.put("/:id", authMiddleware, updateLead);
router.put("/:id/convert", authMiddleware, convertLead);
router.get("/:id", authMiddleware, getLeadById);

export default router;

