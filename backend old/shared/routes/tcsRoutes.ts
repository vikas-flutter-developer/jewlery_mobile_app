import { Router } from "express";
import { authMiddleware } from "../../lib/authUtils.js";
import {
  calculateTcsEndpoint,
  getTcsTransactions,
  getTcsSummary,
  getTcsCustomerSummary,
  updateTcsStatus,
  getTcsReport,
} from "../../retailer/controllers/compliance/tcsController.js";

const router = Router();

router.post("/calculate", authMiddleware, calculateTcsEndpoint);
router.get("/transactions", authMiddleware, getTcsTransactions);
router.get("/summary", authMiddleware, getTcsSummary);
router.get("/customer/:customerId", authMiddleware, getTcsCustomerSummary);
router.put("/transactions/:id", authMiddleware, updateTcsStatus);
router.get("/report", authMiddleware, getTcsReport);

export default router;
