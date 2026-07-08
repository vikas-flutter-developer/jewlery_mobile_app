import { Request, Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";

export const getFinanceAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      actionType,
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const result = await financeAuditService.getAuditLogs({
      actionType: actionType ? String(actionType) : undefined,
      entityType: entityType ? String(entityType) : undefined,
      entityId: entityId ? String(entityId) : undefined,
      userId: userId ? String(userId) : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Finance audit logs error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch audit logs",
    });
  }
};

export const getFinanceAuditLogsByEntity = async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    if (!entityId) {
      return res.status(400).json({ success: false, error: "entityId is required" });
    }

    const result = await financeAuditService.getAuditLogsByEntityId(entityId, page, limit);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Finance audit logs by entity error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch audit logs",
    });
  }
};

export { buildAuditContextFromRequest };
