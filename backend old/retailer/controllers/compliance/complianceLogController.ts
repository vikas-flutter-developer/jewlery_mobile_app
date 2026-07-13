import { Request, Response } from "express";
import {
  getComplianceLogs,
  getComplianceLogsByEntity,
  ComplianceValidationError,
} from "../../services/compliance/complianceEngineService.js";

export const getComplianceLogsHandler = async (req: Request, res: Response) => {
  try {
    const { actionType, status, entityType, entityId, startDate, endDate, page, limit } =
      req.query;

    const result = await getComplianceLogs({
      actionType: actionType ? String(actionType) : undefined,
      status: status ? String(status) : undefined,
      entityType: entityType ? String(entityType) : undefined,
      entityId: entityId ? String(entityId) : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Compliance logs error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch compliance logs",
    });
  }
};

export const getComplianceLogsByEntityHandler = async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    if (!entityId) {
      return res.status(400).json({ success: false, error: "entityId is required" });
    }

    const result = await getComplianceLogsByEntity(entityId, page, limit);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("Compliance logs by entity error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch compliance logs",
    });
  }
};

export { ComplianceValidationError };
