import express from "express";
import {
  getLoyaltyByPhone,
  getAllLoyalty,
  addPoints,
  redeemPoints,
} from "../controllers/loyalty/loyaltyController.js";

const router = express.Router();

// Get all loyalty records (admin)
router.get("/", getAllLoyalty);

// Add points (called on purchase/scheme payment)
router.post("/add", addPoints);

// Redeem points
router.post("/redeem", redeemPoints);

// Get loyalty record by customer phone
router.get("/:phone", getLoyaltyByPhone);

export default router;
