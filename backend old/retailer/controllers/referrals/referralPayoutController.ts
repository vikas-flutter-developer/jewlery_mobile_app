import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  ReferralPayoutLedger as ReferralPayoutLedgerModel,
  ReferralCommission as ReferralCommissionModel,
  Notification as NotificationModel
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logPayoutAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "ReferralPayoutLedger",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write payout audit log:", err);
  }
};

// Helper to send notifications
const triggerPayoutNotification = async (tenantId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL") => {
  try {
    if (isDbConnected()) {
      await NotificationModel.create({
        notificationId: `NOTIF-PAYOUT-${Date.now()}`,
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
    console.error("Failed to send payout notification:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/referral-payouts ────────────────────────────────────────
export const getPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { status, page = 1, limit = 10 } = req.query;

    const query: any = { tenantId };
    if (status) query.status = status;

    const skipIndex = (Number(page) - 1) * Number(limit);
    const total = await ReferralPayoutLedgerModel.countDocuments(query);
    const payouts = await ReferralPayoutLedgerModel.find(query)
      .populate("referralPartnerId", "name partnerCode partnerType")
      .populate({
        path: "commissionId",
        populate: {
          path: "referralId",
          select: "referredStoreName ownerName"
        }
      })
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: payouts,
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

// ─── GET /api/referral-payouts/:id ────────────────────────────────────
export const getPayoutById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const payout = await ReferralPayoutLedgerModel.findOne({ _id: id, tenantId })
      .populate("referralPartnerId", "name partnerCode partnerType")
      .populate({
        path: "commissionId",
        populate: {
          path: "referralId",
          select: "referredStoreName ownerName"
        }
      })
      .lean();
    if (!payout) {
      return res.status(404).json({ success: false, error: "Referral payout profile not found" });
    }
    return res.json({ success: true, data: payout });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/referral-payouts ───────────────────────────────────────
export const createPayout = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral payouts" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { commissionId, referralPartnerId, earnedAmount, remarks } = req.body;

    if (!commissionId || !referralPartnerId || earnedAmount === undefined) {
      return res.status(400).json({ success: false, error: "commissionId, referralPartnerId, and earnedAmount are required fields" });
    }

    const existing = await ReferralPayoutLedgerModel.findOne({ tenantId, commissionId });
    if (existing) {
      return res.status(400).json({ success: false, error: "A payout ledger profile has already been mapped to this commission ID" });
    }

    const payout = await ReferralPayoutLedgerModel.create({
      tenantId,
      commissionId,
      referralPartnerId,
      earnedAmount,
      paidAmount: 0,
      pendingAmount: earnedAmount,
      status: "EARNED",
      remarks: remarks ? remarks.trim() : ""
    });

    await logPayoutAction(tenantId, String(req.user?.email), "PAYOUT_CREATED", `Manually logged referral payout entry. Amount: ${earnedAmount}`);

    return res.status(201).json({ success: true, data: payout });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referral-payouts/:id/pay ────────────────────────────────
export const processPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral payouts" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { amount, paymentMethod, referenceNumber, remarks } = req.body;

    if (!amount || amount <= 0 || !paymentMethod || !referenceNumber) {
      return res.status(400).json({ success: false, error: "amount (greater than 0), paymentMethod, and referenceNumber are required fields" });
    }

    const payout = await ReferralPayoutLedgerModel.findOne({ _id: id, tenantId })
      .populate("referralPartnerId", "name partnerCode");
    if (!payout) {
      return res.status(404).json({ success: false, error: "Referral payout ledger entry not found" });
    }

    if (payout.status === "CANCELLED") {
      return res.status(400).json({ success: false, error: "Cannot process payments on a cancelled referral payout" });
    }

    const nextPaidAmount = payout.paidAmount + Number(amount);
    if (nextPaidAmount > payout.earnedAmount) {
      return res.status(400).json({ success: false, error: "Payment amount exceeds the outstanding earned commission balance (overpayment prevention)" });
    }

    payout.paidAmount = nextPaidAmount;
    payout.pendingAmount = payout.earnedAmount - nextPaidAmount;
    payout.paymentDate = new Date();
    payout.paymentMethod = paymentMethod;
    payout.referenceNumber = referenceNumber;
    if (remarks !== undefined) payout.remarks = remarks ? remarks.trim() : "";

    if (payout.pendingAmount === 0) {
      payout.status = "PAID";
    } else {
      payout.status = "PARTIALLY_PAID";
    }

    await payout.save();

    const partnerName = (payout.referralPartnerId as any)?.name || "Partner";
    await logPayoutAction(tenantId, String(req.user?.email), "PAYOUT_PAYMENT_PROCESSED", `Processed payment of Rs ${amount} for partner ${partnerName}. Status: ${payout.status}`);
    await triggerPayoutNotification(tenantId, "Referral Payout Processed", `Processed payment of Rs ${amount} to ${partnerName} via ${paymentMethod}.`, "INFO");

    return res.json({ success: true, data: payout });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/referral-payouts/summary ────────────────────────────────
export const getPayoutsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";

    const [allPayouts, pendingPayouts] = await Promise.all([
      ReferralPayoutLedgerModel.find({ tenantId }).lean(),
      ReferralPayoutLedgerModel.find({ tenantId, pendingAmount: { $gt: 0 } }).lean()
    ]);

    const totalEarned = allPayouts.reduce((sum, p) => sum + (p.earnedAmount || 0), 0);
    const totalPaid = allPayouts.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalPending = allPayouts.reduce((sum, p) => sum + (p.pendingAmount || 0), 0);

    // Count outstanding partners
    const outstandingPartnersCount = new Set(
      pendingPayouts.map(p => String(p.referralPartnerId))
    ).size;

    return res.json({
      success: true,
      data: {
        totalEarned,
        totalPaid,
        totalPending,
        outstandingPartners: outstandingPartnersCount
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
