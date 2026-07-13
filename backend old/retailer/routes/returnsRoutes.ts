import express from "express";
import {
  createSalesReturn,
  createExchange,
  getSalesReturns,
  getExchanges,
  getAvailableInvoices,
  updateReturnRefund,
  getReturnReasonsReport,
} from "../controllers/returns/returnsController.js";

const router = express.Router();

// Sales Return endpoints (Feature 92, 94, 95)
router.post("/sales", createSalesReturn);
router.get("/sales", getSalesReturns);
router.patch("/sales/:returnId/refund", updateReturnRefund);
router.get("/reasons-report", getReturnReasonsReport);

// Exchange endpoints (Feature 93, 94, 95)
router.post("/exchange", createExchange);
router.get("/exchange", getExchanges);

// Get available invoices for returns/exchanges
router.get("/invoices", getAvailableInvoices);

// Legacy purchase return endpoint
router.post("/purchase", (req, res) => res.status(201).json({ success: true, message: "Purchase return processed" }));

export default router;


