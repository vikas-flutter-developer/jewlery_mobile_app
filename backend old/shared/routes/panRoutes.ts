import { Router } from "express";
import { authMiddleware } from "../../lib/authUtils.js";
import {
  validatePan,
  verifyPan,
  getCustomerPanDetails,
} from "../../retailer/controllers/compliance/panController.js";

const router = Router();

router.post("/validate", authMiddleware, validatePan);
router.post("/verify", authMiddleware, verifyPan);
router.get("/:customerId", authMiddleware, getCustomerPanDetails);

export default router;
