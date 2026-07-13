import express from "express";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";
import {
  getFinanceAuditLogs,
  getFinanceAuditLogsByEntity,
} from "../controllers/finance/financeAuditController.js";

const router = express.Router();
const financeRoles = ["ADMIN", "STORE_MANAGER", "RETAILER", "CASHIER"];

router.use(authMiddleware, roleMiddleware(financeRoles));

router.get("/audit-logs", getFinanceAuditLogs);
router.get("/audit-logs/:entityId", getFinanceAuditLogsByEntity);

export default router;
