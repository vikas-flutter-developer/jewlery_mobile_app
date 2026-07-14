import express from "express";
import {
  getPartners,
  getPartnerById,
  createPartner,
  updatePartner,
  blockPartner,
  activatePartner,
  getDashboardStats
} from "../controllers/referrals/referralPartnerController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getPartners);
router.get("/dashboard/stats", authMiddleware, getDashboardStats);
router.get("/:id", authMiddleware, getPartnerById);
router.post("/", authMiddleware, createPartner);
router.put("/:id", authMiddleware, updatePartner);
router.put("/:id/block", authMiddleware, blockPartner);
router.put("/:id/activate", authMiddleware, activatePartner);

export default router;
