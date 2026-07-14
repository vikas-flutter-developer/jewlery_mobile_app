import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { ReferralPartner as ReferralPartnerModel, Notification as NotificationModel } from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logPartnerAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "ReferralPartner",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write referral partner audit log:", err);
  }
};

// Helper to send notifications
const triggerPartnerNotification = async (tenantId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL") => {
  try {
    if (isDbConnected()) {
      await NotificationModel.create({
        notificationId: `NOTIF-PART-${Date.now()}`,
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
    console.error("Failed to send partner notification:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/referral-partners ───────────────────────────────────────
export const getPartners = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { search, partnerType, status, page = 1, limit = 10 } = req.query;

    const query: any = { tenantId };

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { partnerCode: searchRegex }
      ];
    }

    if (partnerType) query.partnerType = partnerType;
    if (status) query.status = status;

    const skipIndex = (Number(page) - 1) * Number(limit);
    const total = await ReferralPartnerModel.countDocuments(query);
    const partners = await ReferralPartnerModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: partners,
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

// ─── GET /api/referral-partners/:id ───────────────────────────────────
export const getPartnerById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const partner = await ReferralPartnerModel.findOne({ _id: id, tenantId }).lean();
    if (!partner) {
      return res.status(404).json({ success: false, error: "Referral partner profile not found" });
    }
    return res.json({ success: true, data: partner });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/referral-partners ──────────────────────────────────────
export const createPartner = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral partners" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { partnerType, name, companyName, mobile, email, address, gstNumber, remarks } = req.body;

    if (!partnerType || !name || !mobile || !email) {
      return res.status(400).json({ success: false, error: "partnerType, name, mobile, and email are required fields" });
    }

    const normEmail = email.trim().toLowerCase();
    const normMobile = mobile.trim();

    // Validate email/mobile uniqueness inside tenant database
    const existing = await ReferralPartnerModel.findOne({
      tenantId,
      $or: [{ email: normEmail }, { mobile: normMobile }]
    });

    if (existing) {
      return res.status(400).json({ success: false, error: "A partner with this email or mobile number already exists" });
    }

    // Auto-generate Partner Code
    const partnerCode = `PART-${Math.floor(100000 + Math.random() * 900000)}`;

    const partner = await ReferralPartnerModel.create({
      tenantId,
      partnerCode,
      partnerType,
      name: name.trim(),
      companyName: companyName ? companyName.trim() : "",
      mobile: normMobile,
      email: normEmail,
      address: address ? address.trim() : "",
      gstNumber: gstNumber ? gstNumber.trim() : "",
      remarks: remarks ? remarks.trim() : "",
      status: "ACTIVE",
      joinedDate: new Date()
    });

    await logPartnerAction(tenantId, String(req.user?.email), "PARTNER_CREATED", `Onboarded referral partner: ${partnerCode} (${name})`);
    await triggerPartnerNotification(tenantId, "New Referral Partner Joined", `Partner ${name} (${partnerCode}) has been onboarded successfully.`, "INFO");

    return res.status(201).json({ success: true, data: partner });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referral-partners/:id ───────────────────────────────────
export const updatePartner = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral partners" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { partnerType, name, companyName, mobile, email, address, gstNumber, remarks } = req.body;

    const partner = await ReferralPartnerModel.findOne({ _id: id, tenantId });
    if (!partner) {
      return res.status(404).json({ success: false, error: "Referral partner profile not found" });
    }

    if (email) {
      const normEmail = email.trim().toLowerCase();
      const existing = await ReferralPartnerModel.findOne({ tenantId, email: normEmail, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, error: "Another partner is already using this email address" });
      }
      partner.email = normEmail;
    }

    if (mobile) {
      const normMobile = mobile.trim();
      const existing = await ReferralPartnerModel.findOne({ tenantId, mobile: normMobile, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, error: "Another partner is already using this mobile number" });
      }
      partner.mobile = normMobile;
    }

    if (partnerType !== undefined) partner.partnerType = partnerType;
    if (name !== undefined) partner.name = name.trim();
    if (companyName !== undefined) partner.companyName = companyName ? companyName.trim() : "";
    if (address !== undefined) partner.address = address ? address.trim() : "";
    if (gstNumber !== undefined) partner.gstNumber = gstNumber ? gstNumber.trim() : "";
    if (remarks !== undefined) partner.remarks = remarks ? remarks.trim() : "";

    await partner.save();

    await logPartnerAction(tenantId, String(req.user?.email), "PARTNER_UPDATED", `Updated partner details for: ${partner.partnerCode}`);

    return res.json({ success: true, data: partner });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referral-partners/:id/block ─────────────────────────────
export const blockPartner = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral partners" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const partner = await ReferralPartnerModel.findOne({ _id: id, tenantId });
    if (!partner) {
      return res.status(404).json({ success: false, error: "Referral partner profile not found" });
    }

    partner.status = "BLOCKED";
    await partner.save();

    await logPartnerAction(tenantId, String(req.user?.email), "PARTNER_BLOCKED", `Blocked referral partner: ${partner.partnerCode}`);
    await triggerPartnerNotification(tenantId, "Referral Partner Blocked", `Partner ${partner.name} has been blocked and suspended.`, "WARNING");

    return res.json({ success: true, data: partner });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referral-partners/:id/activate ──────────────────────────
export const activatePartner = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral partners" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";

    const partner = await ReferralPartnerModel.findOne({ _id: id, tenantId });
    if (!partner) {
      return res.status(404).json({ success: false, error: "Referral partner profile not found" });
    }

    partner.status = "ACTIVE";
    await partner.save();

    await logPartnerAction(tenantId, String(req.user?.email), "PARTNER_ACTIVATED", `Activated referral partner: ${partner.partnerCode}`);
    await triggerPartnerNotification(tenantId, "Referral Partner Activated", `Partner ${partner.name} has been activated successfully.`, "INFO");

    return res.json({ success: true, data: partner });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/referral-partners/dashboard/stats ───────────────────────
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, active, blocked, newThisMonth] = await Promise.all([
      ReferralPartnerModel.countDocuments({ tenantId }),
      ReferralPartnerModel.countDocuments({ tenantId, status: "ACTIVE" }),
      ReferralPartnerModel.countDocuments({ tenantId, status: "BLOCKED" }),
      ReferralPartnerModel.countDocuments({ tenantId, joinedDate: { $gte: startOfMonth } })
    ]);

    return res.json({
      success: true,
      data: {
        total,
        active,
        blocked,
        newThisMonth
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
