import express from "express";
import {
  createAccount,
  getAllAccounts,
  getActiveAccounts,
  getAccountByPhone,
  updateAccount,
  deactivateAccount,
  recordLogin,
} from "../controllers/accounts/accountsController.js";

const router = express.Router();

// Create a new account (auto on OTP verify)
router.post("/", createAccount);

// Record login timestamp
router.post("/login", recordLogin);

// Get all accounts (admin)
router.get("/", getAllAccounts);

// Get only active accounts
router.get("/active", getActiveAccounts);

// Get account by phone
router.get("/:phone", getAccountByPhone);

// Update account details
router.put("/:phone", updateAccount);

// Deactivate account
router.patch("/:phone/deactivate", deactivateAccount);

export default router;
