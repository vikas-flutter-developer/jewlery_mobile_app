import express from "express";
import { generateReferralCode, registerReferral, getMyReferrals, getMyRewards, getReferralSummary, processReferralReward } from "../controllers/referrals/referralsController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.post("/generate-code", authMiddleware, generateReferralCode);
router.post("/register", authMiddleware, registerReferral);
router.get("/my-referrals", authMiddleware, getMyReferrals);
router.get("/my-rewards", authMiddleware, getMyRewards);
router.get("/summary", authMiddleware, getReferralSummary);
router.post("/reward", authMiddleware, processReferralReward);

export default router;
