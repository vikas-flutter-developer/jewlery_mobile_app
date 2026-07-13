import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { getCustomers, createCustomer, getCustomerById, updateCustomer, searchCustomers, uploadCustomerKyc, getCustomerCreditSummary, updateCustomerCreditLimit, blockCustomerCredit, unblockCustomerCredit, getVipCustomers, getBlacklistedCustomers, getCustomerTierSummary, markCustomerVip, removeCustomerVip, blacklistCustomer, removeCustomerBlacklist } from "../controllers/customers/customersController.js";
import { 
  getCustomerCelebrations, 
  getCustomerTimeline, 
  getReactivationList, 
  sendMarketingCampaignBlast, 
  getReferralNetwork, 
  getQuotations, 
  createQuotation, 
  updateQuotationStatus 
} from "../controllers/customers/advancedCustomersController.js";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const baseDir = path.resolve(process.cwd(), "backend", "uploads", "customers", String(req.params.id || "misc"));
      fs.mkdirSync(baseDir, { recursive: true });
      cb(null, baseDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".bin");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
});

// Advanced Customer routes (Static first to avoid Parameter collision)
router.get("/celebrations", authMiddleware, getCustomerCelebrations);
router.get("/reactivation", authMiddleware, getReactivationList);
router.get("/referrals", authMiddleware, getReferralNetwork);
router.get("/quotes", authMiddleware, getQuotations);
router.post("/quotes", authMiddleware, createQuotation);
router.put("/quotes/:quoteId", authMiddleware, updateQuotationStatus);
router.post("/campaign/blast", authMiddleware, sendMarketingCampaignBlast);

const financeRoles = ["ADMIN", "STORE_MANAGER", "RETAILER", "CASHIER"];

// Core Customer routes
router.get("/", authMiddleware, getCustomers);
router.get("/search", authMiddleware, searchCustomers);
router.get("/vip", authMiddleware, getVipCustomers);
router.get("/blacklist", authMiddleware, getBlacklistedCustomers);
router.get("/blacklisted", authMiddleware, getBlacklistedCustomers);
router.get("/tier-summary", authMiddleware, getCustomerTierSummary);
router.get("/customer-tier-summary", authMiddleware, getCustomerTierSummary);
router.post("/", authMiddleware, createCustomer);

// Tier management (supporting both POST and PUT)
router.post("/:id/mark-vip", authMiddleware, roleMiddleware(financeRoles), markCustomerVip);
router.put("/:id/mark-vip", authMiddleware, roleMiddleware(financeRoles), markCustomerVip);

router.post("/:id/remove-vip", authMiddleware, roleMiddleware(financeRoles), removeCustomerVip);
router.put("/:id/remove-vip", authMiddleware, roleMiddleware(financeRoles), removeCustomerVip);

router.post("/:id/blacklist", authMiddleware, roleMiddleware(financeRoles), blacklistCustomer);
router.put("/:id/blacklist", authMiddleware, roleMiddleware(financeRoles), blacklistCustomer);

router.post("/:id/remove-blacklist", authMiddleware, roleMiddleware(financeRoles), removeCustomerBlacklist);
router.put("/:id/remove-blacklist", authMiddleware, roleMiddleware(financeRoles), removeCustomerBlacklist);

// Credit management
router.get("/:id/credit-summary", authMiddleware, roleMiddleware(financeRoles), getCustomerCreditSummary);
router.put("/:id/credit-limit", authMiddleware, roleMiddleware(financeRoles), updateCustomerCreditLimit);
router.post("/:id/block-credit", authMiddleware, roleMiddleware(financeRoles), blockCustomerCredit);
router.post("/:id/unblock-credit", authMiddleware, roleMiddleware(financeRoles), unblockCustomerCredit);

// Dynamic routes
router.get("/:id/timeline", authMiddleware, getCustomerTimeline);
router.post("/:id/kyc", authMiddleware, upload.fields([{ name: "pan", maxCount: 1 }, { name: "aadhar", maxCount: 1 }]), uploadCustomerKyc);
router.get("/:id", authMiddleware, getCustomerById);
router.put("/:id", authMiddleware, updateCustomer);

export default router;



