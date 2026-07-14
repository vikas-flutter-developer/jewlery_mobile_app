import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  VendorRateRule as VendorRateRuleModel,
  Notification as NotificationModel
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logRuleAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "VendorRateRule",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write rule audit log:", err);
  }
};

// Helper to send notifications
const triggerRuleNotification = async (tenantId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL") => {
  try {
    if (isDbConnected()) {
      await NotificationModel.create({
        notificationId: `NOTIF-RULE-${Date.now()}`,
        tenantId,
        storeId: tenantId,
        type: "VENDOR_ALERT",
        title,
        message,
        category: "VendorRateRules",
        severity,
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING"
      });
    }
  } catch (err) {
    console.error("Failed to send rule notification:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  const allowed = ["ADMIN", "SUPER_ADMIN", "PURCHASE_MANAGER", "RETAILER", "STORE_MANAGER"];
  return allowed.includes(req.user?.role || "");
};

// Auto expire rules that are past their effectiveTo date
const runAutoExpiryCheck = async (tenantId: string) => {
  try {
    if (isDbConnected()) {
      const now = new Date();
      const expiredRules = await VendorRateRuleModel.find({
        tenantId,
        status: "ACTIVE",
        effectiveTo: { $lt: now }
      });

      for (const rule of expiredRules) {
        rule.status = "EXPIRED";
        await rule.save();
        await logRuleAction(tenantId, "SYSTEM", "RULE_EXPIRED", `Rate rule ID: ${rule._id} has auto-expired.`);
        await triggerRuleNotification(tenantId, "Vendor Rate Rule Expired", `Rate rule for metal ${rule.metalType} (${rule.purity}) has expired.`, "WARNING");
      }
    }
  } catch (err) {
    console.error("Failed to run auto-expiry checks:", err);
  }
};

// ─── GET /api/vendor-contract-rules ──────────────────────────────────
export const getRules = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    await runAutoExpiryCheck(tenantId);

    const { vendorId, metalType, status, purity, page = 1, limit = 10 } = req.query;
    const query: any = { tenantId };

    if (vendorId) query.vendorId = vendorId;
    if (metalType) query.metalType = metalType;
    if (status) query.status = status;
    if (purity) query.purity = new RegExp(String(purity), "i");

    const skipIndex = (Number(page) - 1) * Number(limit);
    const total = await VendorRateRuleModel.countDocuments(query);
    const rules = await VendorRateRuleModel.find(query)
      .populate("vendorId", "name code mobile")
      .populate("contractId", "contractNumber")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: rules,
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

// ─── GET /api/vendor-contract-rules/:id ──────────────────────────────
export const getRuleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const rule = await VendorRateRuleModel.findOne({ _id: id, tenantId })
      .populate("vendorId", "name code mobile")
      .populate("contractId", "contractNumber")
      .lean();
    if (!rule) {
      return res.status(404).json({ success: false, error: "Vendor rate rule profile not found" });
    }
    return res.json({ success: true, data: rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/vendor-contract-rules ─────────────────────────────────
export const createRule = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate rules" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { contractId, vendorId, metalType, purity, rateType, rateValue, effectiveFrom, effectiveTo } = req.body;

    if (!contractId || !vendorId || !metalType || !purity || !rateType || rateValue === undefined || !effectiveFrom || !effectiveTo) {
      return res.status(400).json({ success: false, error: "contractId, vendorId, metalType, purity, rateType, rateValue, effectiveFrom, and effectiveTo are required fields" });
    }

    // Metal type check
    if (!["GOLD", "SILVER", "PLATINUM"].includes(metalType)) {
      return res.status(400).json({ success: false, error: "metalType must be one of GOLD, SILVER, or PLATINUM" });
    }

    const fromDate = new Date(effectiveFrom);
    const toDate = new Date(effectiveTo);

    if (fromDate >= toDate) {
      return res.status(400).json({ success: false, error: "effectiveFrom date must be earlier than effectiveTo date" });
    }

    const rule = await VendorRateRuleModel.create({
      tenantId,
      contractId,
      vendorId,
      metalType,
      purity: purity.trim(),
      rateType,
      rateValue,
      effectiveFrom: fromDate,
      effectiveTo: toDate,
      status: "INACTIVE"
    });

    await logRuleAction(tenantId, String(req.user?.email), "RULE_CREATED", `Created vendor rate rule for metal ${metalType} (${purity})`);

    return res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contract-rules/:id ──────────────────────────────
export const updateRule = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate rules" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { metalType, purity, rateType, rateValue, effectiveFrom, effectiveTo } = req.body;

    const rule = await VendorRateRuleModel.findOne({ _id: id, tenantId });
    if (!rule) {
      return res.status(404).json({ success: false, error: "Vendor rate rule profile not found" });
    }

    if (rule.status !== "INACTIVE") {
      return res.status(400).json({ success: false, error: "Only INACTIVE rules can be modified" });
    }

    if (metalType && !["GOLD", "SILVER", "PLATINUM"].includes(metalType)) {
      return res.status(400).json({ success: false, error: "metalType must be one of GOLD, SILVER, or PLATINUM" });
    }

    if (effectiveFrom || effectiveTo) {
      const fromDate = effectiveFrom ? new Date(effectiveFrom) : rule.effectiveFrom;
      const toDate = effectiveTo ? new Date(effectiveTo) : rule.effectiveTo;

      if (fromDate >= toDate) {
        return res.status(400).json({ success: false, error: "effectiveFrom date must be earlier than effectiveTo date" });
      }

      rule.effectiveFrom = fromDate;
      rule.effectiveTo = toDate;
    }

    if (metalType !== undefined) rule.metalType = metalType;
    if (purity !== undefined) rule.purity = purity.trim();
    if (rateType !== undefined) rule.rateType = rateType;
    if (rateValue !== undefined) rule.rateValue = rateValue;

    await rule.save();

    await logRuleAction(tenantId, String(req.user?.email), "RULE_UPDATED", `Updated vendor rate rule ID: ${id}`);

    return res.json({ success: true, data: rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contract-rules/:id/activate ─────────────────────
export const activateRule = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate rules" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const rule = await VendorRateRuleModel.findOne({ _id: id, tenantId });
    if (!rule) {
      return res.status(404).json({ success: false, error: "Vendor rate rule profile not found" });
    }

    if (rule.status !== "INACTIVE" && rule.status !== "EXPIRED") {
      return res.status(400).json({ success: false, error: `Cannot activate a rule in ${rule.status} status` });
    }

    // Check overlapping ACTIVE rules for same Vendor + Metal + Purity during the same date range
    const overlapping = await VendorRateRuleModel.findOne({
      tenantId,
      vendorId: rule.vendorId,
      metalType: rule.metalType,
      purity: rule.purity,
      status: "ACTIVE",
      effectiveFrom: { $lte: rule.effectiveTo },
      effectiveTo: { $gte: rule.effectiveFrom }
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: `Cannot activate rule. There is an overlapping active rule: ${overlapping._id}`
      });
    }

    rule.status = "ACTIVE";
    await rule.save();

    await logRuleAction(tenantId, String(req.user?.email), "RULE_ACTIVATED", `Activated vendor rate rule: ${rule._id}`);
    await triggerRuleNotification(tenantId, "Vendor Rate Rule Activated", `Rate rule for metal ${rule.metalType} (${rule.purity}) is now active.`, "INFO");

    return res.json({ success: true, data: rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/vendor-contract-rules/:id/deactivate ───────────────────
export const deactivateRule = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage vendor rate rules" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const rule = await VendorRateRuleModel.findOne({ _id: id, tenantId });
    if (!rule) {
      return res.status(404).json({ success: false, error: "Vendor rate rule profile not found" });
    }

    rule.status = "INACTIVE";
    await rule.save();

    await logRuleAction(tenantId, String(req.user?.email), "RULE_DEACTIVATED", `Deactivated vendor rate rule: ${rule._id}`);
    await triggerRuleNotification(tenantId, "Vendor Rate Rule Deactivated", `Rate rule for metal ${rule.metalType} (${rule.purity}) has been deactivated.`, "WARNING");

    return res.json({ success: true, data: rule });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/vendor-contract-rules/summary ──────────────────────────
export const getRulesSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    await runAutoExpiryCheck(tenantId);

    const now = new Date();
    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(expiringSoonDate.getDate() + 30);

    const [active, expiringSoonList, gold, silver, platinum] = await Promise.all([
      VendorRateRuleModel.countDocuments({ tenantId, status: "ACTIVE" }),
      VendorRateRuleModel.find({
        tenantId,
        status: "ACTIVE",
        effectiveTo: { $gte: now, $lte: expiringSoonDate }
      }),
      VendorRateRuleModel.countDocuments({ tenantId, metalType: "GOLD" }),
      VendorRateRuleModel.countDocuments({ tenantId, metalType: "SILVER" }),
      VendorRateRuleModel.countDocuments({ tenantId, metalType: "PLATINUM" })
    ]);

    // Send notifications for rules expiring within 30 days
    for (const rule of expiringSoonList) {
      const daysRemaining = Math.ceil((new Date(rule.effectiveTo).getTime() - now.getTime()) / (1000 * 3600 * 24));
      await triggerRuleNotification(
        tenantId,
        "Vendor Rate Rule Expiring Soon",
        `Rate rule for metal ${rule.metalType} (${rule.purity}) expires in ${daysRemaining} days.`,
        "WARNING"
      );
    }

    return res.json({
      success: true,
      data: {
        active,
        expiringSoon: expiringSoonList.length,
        metals: {
          gold,
          silver,
          platinum
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
