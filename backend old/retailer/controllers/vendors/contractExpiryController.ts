import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  checkAndAlertExpiring,
  getExpiringContracts,
  getExpirySummary,
} from "../../services/vendors/contractExpiryService.js";
import { isDbConnected } from "../../../lib/db.js";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "PURCHASE_MANAGER", "RETAILER", "STORE_MANAGER"];

const isAuthorized = (req: AuthRequest) =>
  ALLOWED_ROLES.includes(req.user?.role || "");

// ─── GET /api/vendor-contracts/expiring ──────────────────────────────────────
export const getExpiringContractsHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to view expiry alerts" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const {
      daysWindow = "30",
      vendorId,
      metalType,
      page = "1",
      limit = "10",
    } = req.query;

    const parsedWindow = Math.min(Math.max(Number(daysWindow) || 30, 1), 90);

    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, limit: Number(limit), pages: 0 },
      });
    }

    const { data, total } = await getExpiringContracts(
      tenantId,
      parsedWindow,
      vendorId as string | undefined,
      metalType as string | undefined,
      Number(page),
      Number(limit)
    );

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/vendor-contracts/expiry-summary ─────────────────────────────────
export const getExpirySummaryHandler = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";

    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: { total: 0, active: 0, expired: 0, expiringSoon: 0, expiring30Days: 0, expiring15Days: 0, expiring7Days: 0, expiring1Day: 0 },
      });
    }

    const summary = await getExpirySummary(tenantId);

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/vendor-contracts/check-expiry ──────────────────────────────────
export const checkExpiryHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to run expiry check" });
    }

    const tenantId = req.user?.tenantId || "default-shop";

    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: { alertsGenerated: 0, contractsExpired: 0, contractsExpiringSoon: 0 },
        message: "Database offline — expiry check skipped",
      });
    }

    const result = await checkAndAlertExpiring(tenantId);

    return res.json({
      success: true,
      data: result,
      message: `Expiry check complete. ${result.alertsGenerated} alert(s) generated, ${result.contractsExpired} contract(s) expired.`,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
