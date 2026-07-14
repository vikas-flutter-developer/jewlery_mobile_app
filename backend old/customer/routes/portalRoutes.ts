import express from "express";
import {
  requestOtp,
  verifyOtp,
  getCustomerSchemes,
  paySchemeInstallment,
  submitCustomOrder,
  getCustomOrders,
  createPortalCheckout,
  getPortalCheckouts,
  approvePortalCheckoutPayment,
  getAvailableSchemes,
  updateProfile
} from "../controllers/portal/portalController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

// Authentication
router.post("/auth/otp", requestOtp);
router.post("/auth/verify", verifyOtp);

// Profile Management
router.put("/profile", authMiddleware, updateProfile);

// Schemes Passbooks & Catalog Book
router.get("/schemes", getAvailableSchemes);
router.get("/customer-schemes", getCustomerSchemes);
router.post("/pay-installment", paySchemeInstallment);

// Bespoke custom designs
router.post("/custom-order", submitCustomOrder);
router.get("/custom-order", getCustomOrders);

// Self Checkouts & Counter Payments
router.post("/checkout", createPortalCheckout);
router.get("/checkouts", getPortalCheckouts);
router.put("/checkouts/:id/pay", authMiddleware, approvePortalCheckoutPayment);

export default router;



