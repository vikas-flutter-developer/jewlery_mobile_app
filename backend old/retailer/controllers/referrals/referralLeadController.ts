import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  ReferralLead as ReferralLeadModel,
  ReferralPartner as ReferralPartnerModel,
  Notification as NotificationModel
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logLeadAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "ReferralLead",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write referral lead audit log:", err);
  }
};

// Helper to send notifications
const triggerLeadNotification = async (tenantId: string, title: string, message: string, severity: "INFO" | "WARNING" | "CRITICAL") => {
  try {
    if (isDbConnected()) {
      await NotificationModel.create({
        notificationId: `NOTIF-LEAD-${Date.now()}`,
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
    console.error("Failed to send lead notification:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/referrals ───────────────────────────────────────────────
export const getLeads = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { search, status, referralPartnerId, page = 1, limit = 10 } = req.query;

    const query: any = { tenantId };

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      query.$or = [
        { referredStoreName: searchRegex },
        { ownerName: searchRegex },
        { email: searchRegex }
      ];
    }

    if (status) query.status = status;
    if (referralPartnerId) query.referralPartnerId = referralPartnerId;

    const skipIndex = (Number(page) - 1) * Number(limit);
    const total = await ReferralLeadModel.countDocuments(query);
    const leads = await ReferralLeadModel.find(query)
      .populate("referralPartnerId", "name partnerCode partnerType")
      .sort({ createdAt: -1 })
      .skip(skipIndex)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: leads,
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

// ─── GET /api/referrals/:id ───────────────────────────────────────────
export const getLeadById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const lead = await ReferralLeadModel.findOne({ _id: id, tenantId })
      .populate("referralPartnerId", "name partnerCode partnerType")
      .lean();
    if (!lead) {
      return res.status(404).json({ success: false, error: "Referral lead profile not found" });
    }
    return res.json({ success: true, data: lead });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/referrals ──────────────────────────────────────────────
export const createLead = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral tracking" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { referralPartnerId, referredStoreName, ownerName, mobile, email, source, remarks } = req.body;

    if (!referralPartnerId || !referredStoreName || !ownerName || !mobile || !email) {
      return res.status(400).json({ success: false, error: "referralPartnerId, referredStoreName, ownerName, mobile, and email are required fields" });
    }

    // Verify referral partner profile exists and is active
    const partner = await ReferralPartnerModel.findOne({ _id: referralPartnerId, tenantId });
    if (!partner) {
      return res.status(404).json({ success: false, error: "Referral partner profile not found" });
    }
    if (partner.status !== "ACTIVE") {
      return res.status(400).json({ success: false, error: "Referral partner profile must be ACTIVE to refer new leads" });
    }

    const normEmail = email.trim().toLowerCase();
    const normMobile = mobile.trim();

    // Enforce email/mobile uniqueness inside tenant database
    const existing = await ReferralLeadModel.findOne({
      tenantId,
      $or: [{ email: normEmail }, { mobile: normMobile }]
    });

    if (existing) {
      return res.status(400).json({ success: false, error: "A referral lead with this email or mobile number already exists" });
    }

    const lead = await ReferralLeadModel.create({
      tenantId,
      referralPartnerId,
      referredStoreName: referredStoreName.trim(),
      ownerName: ownerName.trim(),
      mobile: normMobile,
      email: normEmail,
      source: source || "Direct",
      remarks: remarks ? remarks.trim() : "",
      status: "LEAD"
    });

    await logLeadAction(tenantId, String(req.user?.email), "LEAD_CREATED", `Registered referral lead: ${referredStoreName} for partner ${partner.partnerCode}`);

    return res.status(201).json({ success: true, data: lead });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referrals/:id ───────────────────────────────────────────
export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral tracking" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { referredStoreName, ownerName, mobile, email, source, status, remarks } = req.body;

    const lead = await ReferralLeadModel.findOne({ _id: id, tenantId });
    if (!lead) {
      return res.status(404).json({ success: false, error: "Referral lead not found" });
    }

    // Prevent changing properties if already converted
    if (lead.status === "CONVERTED" && status !== undefined && status !== "CONVERTED") {
      return res.status(400).json({ success: false, error: "Cannot change status of a converted lead" });
    }

    if (email) {
      const normEmail = email.trim().toLowerCase();
      const existing = await ReferralLeadModel.findOne({ tenantId, email: normEmail, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, error: "Another lead is already using this email address" });
      }
      lead.email = normEmail;
    }

    if (mobile) {
      const normMobile = mobile.trim();
      const existing = await ReferralLeadModel.findOne({ tenantId, mobile: normMobile, _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, error: "Another lead is already using this mobile number" });
      }
      lead.mobile = normMobile;
    }

    const oldStatus = lead.status;
    if (referredStoreName !== undefined) lead.referredStoreName = referredStoreName.trim();
    if (ownerName !== undefined) lead.ownerName = ownerName.trim();
    if (source !== undefined) lead.source = source;
    if (remarks !== undefined) lead.remarks = remarks ? remarks.trim() : "";
    if (status !== undefined) lead.status = status;

    await lead.save();

    if (status !== undefined && oldStatus !== status) {
      await logLeadAction(tenantId, String(req.user?.email), "LEAD_STATUS_CHANGED", `Changed status for lead ${lead.referredStoreName} from ${oldStatus} to ${status}`);
    }

    return res.json({ success: true, data: lead });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/referrals/:id/convert ───────────────────────────────────
export const convertLead = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage referral tracking" });
    }

    const { id } = req.params;
    const tenantId = req.user?.tenantId || "default-shop";
    const { convertedTenantId } = req.body;

    if (!convertedTenantId) {
      return res.status(400).json({ success: false, error: "convertedTenantId is required to complete conversion" });
    }

    const lead = await ReferralLeadModel.findOne({ _id: id, tenantId });
    if (!lead) {
      return res.status(404).json({ success: false, error: "Referral lead not found" });
    }

    if (lead.status === "CONVERTED") {
      return res.status(400).json({ success: false, error: "This referral lead is already converted" });
    }

    // Ensure one store can only be converted once per tenant
    const existingConversion = await ReferralLeadModel.findOne({
      tenantId,
      convertedTenantId,
      status: "CONVERTED"
    });
    if (existingConversion) {
      return res.status(400).json({ success: false, error: "A store has already been mapped to this converted tenant ID" });
    }

    lead.status = "CONVERTED";
    lead.convertedTenantId = convertedTenantId;
    lead.conversionDate = new Date();
    await lead.save();

    await logLeadAction(tenantId, String(req.user?.email), "LEAD_CONVERTED", `Successfully converted lead: ${lead.referredStoreName} (Tenant ID: ${convertedTenantId})`);
    await triggerLeadNotification(tenantId, "Referral Lead Converted", `Lead ${lead.referredStoreName} has been successfully converted into store tenant ${convertedTenantId}.`, "INFO");

    return res.json({ success: true, data: lead });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/referrals/summary (Leads Summary) ───────────────────────
export const getLeadsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";

    const [total, active, converted, lost] = await Promise.all([
      ReferralLeadModel.countDocuments({ tenantId }),
      ReferralLeadModel.countDocuments({ tenantId, status: { $in: ["LEAD", "CONTACTED", "DEMO_SCHEDULED", "NEGOTIATION"] } }),
      ReferralLeadModel.countDocuments({ tenantId, status: "CONVERTED" }),
      ReferralLeadModel.countDocuments({ tenantId, status: "LOST" })
    ]);

    const conversionRate = total > 0 ? Number(((converted / total) * 100).toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        total,
        active,
        converted,
        lost,
        conversionRate
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
