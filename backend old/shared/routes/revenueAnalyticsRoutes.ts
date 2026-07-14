import express from "express";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";
import {
  getRevenueDashboard,
  getRevenueSales,
  getRevenueCustomers,
  getRevenueProducts,
  getRevenueSummary
} from "../controllers/analytics/revenueAnalyticsController.js";
import {
  getRevenueAnalyticsReport,
  getRevenueByStoreReport,
  getRevenueByProductReport
} from "../controllers/reports/revenueReportsController.js";

const router = express.Router();
const allowedRoles = ["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_ADMIN", "ACCOUNTANT", "SALES"];

router.get("/dashboard", authMiddleware, roleMiddleware(allowedRoles), getRevenueDashboard);
router.get("/sales", authMiddleware, roleMiddleware(allowedRoles), getRevenueSales);
router.get("/customers", authMiddleware, roleMiddleware(allowedRoles), getRevenueCustomers);
router.get("/products", authMiddleware, roleMiddleware(allowedRoles), getRevenueProducts);
router.get("/summary", authMiddleware, roleMiddleware(allowedRoles), getRevenueSummary);

// Reports
router.get("/report/overall", authMiddleware, roleMiddleware(allowedRoles), getRevenueAnalyticsReport);
router.get("/report/store", authMiddleware, roleMiddleware(allowedRoles), getRevenueByStoreReport);
router.get("/report/product", authMiddleware, roleMiddleware(allowedRoles), getRevenueByProductReport);

export default router;
