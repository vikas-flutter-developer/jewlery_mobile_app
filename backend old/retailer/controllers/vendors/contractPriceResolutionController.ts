import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { PriceResolutionLog } from "../../models/index.js";
import { resolvePrice, PriceResolutionInput } from "../../services/vendors/contractPriceResolutionService.js";
import { isDbConnected } from "../../../lib/db.js";

const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "PURCHASE_MANAGER", "RETAILER", "STORE_MANAGER"];

const isAuthorized = (req: AuthRequest) =>
  ALLOWED_ROLES.includes(req.user?.role || "");

// ─── POST /api/vendor-contracts/resolve-price ─────────────────────────────────
export const resolvePriceHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to access price resolution" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { vendorId, metalType, purity, transactionDate } = req.body;

    if (!vendorId || !metalType || !purity) {
      return res.status(400).json({
        success: false,
        error: "vendorId, metalType, and purity are required"
      });
    }

    if (!["GOLD", "SILVER", "PLATINUM"].includes(metalType)) {
      return res.status(400).json({
        success: false,
        error: "metalType must be one of GOLD, SILVER, or PLATINUM"
      });
    }

    const input: PriceResolutionInput = {
      vendorId,
      metalType,
      purity,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date()
    };

    const result = await resolvePrice(input, tenantId);

    return res.json({
      success: true,
      data: {
        vendorId,
        metalType,
        purity,
        transactionDate: input.transactionDate,
        resolvedRate: result.resolvedRate,
        source: result.source,
        contractId: result.contractId || null,
        ruleId: result.ruleId || null,
        remarks: result.remarks,
        logId: result.logId
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/vendor-contracts/price-history ──────────────────────────────────
export const getPriceHistory = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";

    if (!isDbConnected()) {
      return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 10, pages: 0 } });
    }

    const {
      vendorId,
      metalType,
      source,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const query: any = { tenantId };

    if (vendorId) query.vendorId = vendorId;
    if (metalType) query.metalType = metalType;
    if (source) query.source = source;

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(String(startDate));
      if (endDate) query.transactionDate.$lte = new Date(String(endDate));
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await PriceResolutionLog.countDocuments(query);
    const logs = await PriceResolutionLog.find(query)
      .populate("vendorId", "name code")
      .populate("contractId", "contractNumber")
      .populate("ruleId", "rateType rateValue purity metalType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Build source breakdown summary
    const [contractRuleCount, purchasePriceCount, defaultRateCount] = await Promise.all([
      PriceResolutionLog.countDocuments({ tenantId, source: "CONTRACT_RULE" }),
      PriceResolutionLog.countDocuments({ tenantId, source: "PURCHASE_PRICE" }),
      PriceResolutionLog.countDocuments({ tenantId, source: "DEFAULT_RATE" })
    ]);

    return res.json({
      success: true,
      data: logs,
      summary: {
        contractRuleResolutions: contractRuleCount,
        purchasePriceFallbacks: purchasePriceCount,
        defaultRateFallbacks: defaultRateCount,
        total: contractRuleCount + purchasePriceCount + defaultRateCount
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
