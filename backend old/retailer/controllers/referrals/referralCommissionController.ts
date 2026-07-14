import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  ReferralCommission as ReferralCommissionModel,
  ReferralLead as ReferralLeadModel,
  Notification as NotificationModel,
  ReferralPayoutLedger as ReferralPayoutLedgerModel
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logCommissionAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "ReferralCommission",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write commission audit log:", err);
  }
};

// Helper to send notifications
const triggerCommissionNotification = async (tenantId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL") => {
  try {
    if (isDbConnected()) {
      await NotificationModel.create({
        notificationId: `NOTIF-COMM-${Date.now()}`,
        tenantId,
        storeId: tenantId,
        type: "REFERRAL_ALERT",
        title,
        message,
        category: "ReferralSystem",
        severity,
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING"
      });
    }
  } catch (err) {
    console.error("Failed to send commission notification:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/referral-commissions ────────────────────────────────────
export const getCommissions = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { status, page = 1, limit = 10 } = req.query;

    const query: any = { tenantId };
    if (status) query.status = status;

    const skipIndex = (Number(page) - 1) * Number(limit);
    const total = await ReferralCommissionModel.countDocuments(query);
    const commissions = await ReferralCommissionModel.find(query)
      .populate("referralPartnerId", "name partnerCode partnerType")
      .populate("referralId", "referredStoreName ownerName email mobile")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: commissions,
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

// ─── GET /api/referral-commissions/:id ────────────────────────────────
export const getCommissionById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const commission = await ReferralCommissionModel.findOne({ _id: id, tenantId })
      .populate("referralPartnerId", "name partnerCode partnerType")
      .populate("referralId", "referredStoreName ownerName email mobile")
      .lean();
    if (!commission) {
      return res.status(404).json({ success: false, error: "Referral commission profile not found" });
    }
    return res.json({ success: true, data: commission });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/referral-commissions/calculate ─────────────────────────
export const calculateCommission = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral commissions" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { referralId, commissionType, commissionValue, subscriptionAmount = 0, remarks } = req.body;

    if (!referralId || !commissionType || commissionValue === undefined) {
      return res.status(400).json({ success: false, error: "referralId, commissionType, and commissionValue are required fields" });
    }

    if (commissionValue < 0 || subscriptionAmount < 0) {
      return res.status(400).json({ success: false, error: "Commission values and subscription amounts cannot be negative" });
    }

    // Verify converted lead
    const lead = await ReferralLeadModel.findOne({ _id: referralId, tenantId });
    if (!lead) {
      return res.status(404).json({ success: false, error: "Referred lead profile not found" });
    }
    if (lead.status !== "CONVERTED") {
      return res.status(400).json({ success: false, error: "Commissions can only be calculated for CONVERTED referral leads" });
    }

    // Check duplicate commission creations
    const existing = await ReferralCommissionModel.findOne({ tenantId, referralId });
    if (existing) {
      return res.status(400).json({ success: false, error: "A commission profile has already been calculated for this referred lead" });
    }

    // Calculate Amount
    let commissionAmount = 0;
    if (commissionType === "FIXED") {
      commissionAmount = Number(commissionValue);
    } else if (commissionType === "PERCENTAGE") {
      commissionAmount = Number(subscriptionAmount) * (Number(commissionValue) / 100);
    } else {
      return res.status(400).json({ success: false, error: "Invalid commissionType. Must be FIXED or PERCENTAGE" });
    }

    const commission = await ReferralCommissionModel.create({
      tenantId,
      referralId,
      referralPartnerId: lead.referralPartnerId,
      commissionType,
      commissionValue,
      commissionAmount,
      subscriptionAmount,
      status: "PENDING",
      remarks: remarks ? remarks.trim() : ""
    });

    await logCommissionAction(tenantId, String(req.user?.email), "COMMISSION_CALCULATED", `Calculated commission for lead: ${lead.referredStoreName}. Amount: ${commissionAmount}`);

    return res.status(201).json({ success: true, data: commission });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referral-commissions/:id/approve ────────────────────────
export const approveCommission = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral commissions" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const commission = await ReferralCommissionModel.findOne({ _id: id, tenantId })
      .populate("referralPartnerId", "name partnerCode");
    if (!commission) {
      return res.status(404).json({ success: false, error: "Commission profile not found" });
    }

    if (commission.status !== "PENDING") {
      return res.status(400).json({ success: false, error: `Cannot approve commission in ${commission.status} status` });
    }

    commission.status = "APPROVED";
    await commission.save();

    // Automatically create a Payout Ledger entry
    await ReferralPayoutLedgerModel.create({
      tenantId,
      referralPartnerId: commission.referralPartnerId,
      commissionId: commission._id,
      earnedAmount: commission.commissionAmount,
      paidAmount: 0,
      pendingAmount: commission.commissionAmount,
      status: "EARNED"
    });

    const partnerName = (commission.referralPartnerId as any)?.name || "Partner";
    await logCommissionAction(tenantId, String(req.user?.email), "COMMISSION_APPROVED", `Approved commission ID: ${id} for ${partnerName}`);
    await triggerCommissionNotification(tenantId, "Referral Commission Approved", `Commission amount of ${commission.commissionAmount} has been approved for ${partnerName}.`, "INFO");

    return res.json({ success: true, data: commission });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referral-commissions/:id/cancel ─────────────────────────
export const cancelCommission = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral commissions" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const commission = await ReferralCommissionModel.findOne({ _id: id, tenantId });
    if (!commission) {
      return res.status(404).json({ success: false, error: "Commission profile not found" });
    }

    commission.status = "CANCELLED";
    await commission.save();

    // Set related payout ledger entry to CANCELLED if not paid yet
    const payout = await ReferralPayoutLedgerModel.findOne({ tenantId, commissionId: id });
    if (payout && payout.status !== "PAID" && payout.status !== "PARTIALLY_PAID") {
      payout.status = "CANCELLED";
      await payout.save();
    }

    await logCommissionAction(tenantId, String(req.user?.email), "COMMISSION_CANCELLED", `Cancelled commission ID: ${id}`);

    return res.json({ success: true, data: commission });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/referral-commissions/summary ────────────────────────────
export const getCommissionsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";

    const [totalDocs, pendingDocs, approvedDocs, paidDocs] = await Promise.all([
      ReferralCommissionModel.find({ tenantId }).lean(),
      ReferralCommissionModel.find({ tenantId, status: "PENDING" }).lean(),
      ReferralCommissionModel.find({ tenantId, status: "APPROVED" }).lean(),
      ReferralCommissionModel.find({ tenantId, status: "PAID" }).lean()
    ]);

    const sumAmount = (list: any[]) => list.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);

    return res.json({
      success: true,
      data: {
        total: {
          count: totalDocs.length,
          amount: sumAmount(totalDocs)
        },
        pending: {
          count: pendingDocs.length,
          amount: sumAmount(pendingDocs)
        },
        approved: {
          count: approvedDocs.length,
          amount: sumAmount(approvedDocs)
        },
        paid: {
          count: paidDocs.length,
          amount: sumAmount(paidDocs)
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
