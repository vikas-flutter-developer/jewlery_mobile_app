import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { TenantBranding as TenantBrandingModel } from "../../../retailer/models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

// Helper to log user action audits
const logBrandingAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "TenantBranding",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write branding audit log:", err);
  }
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ─── GET /api/settings/tenant-branding ────────────────────────────────────────
export const getTenantBranding = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    let branding = await TenantBrandingModel.findOne({ tenantId }).lean();

    if (!branding) {
      branding = {
        tenantId,
        businessName: "Aura Jewel Store",
        logoUrl: "",
        faviconUrl: "",
        gstNumber: "",
        gstState: "",
        invoicePrefix: "INV",
        invoiceFooter: "Thank you for shopping with us!",
        invoiceTerms: "1. Goods once sold cannot be returned.\n2. Interest of 18% will be charged if payment is delayed.",
        isActive: true
      };
    }

    return res.json({ success: true, data: branding });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/tenant-branding ───────────────────────────────────────
export const createTenantBranding = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { businessName, logoUrl, faviconUrl, gstNumber, gstState, invoicePrefix, invoiceFooter, invoiceTerms } = req.body;

    if (!businessName) {
      return res.status(400).json({ success: false, error: "businessName is required" });
    }

    if (gstNumber && gstNumber.trim() !== "" && !GSTIN_REGEX.test(gstNumber.trim())) {
      return res.status(400).json({ success: false, error: "Invalid GST number format" });
    }

    const existing = await TenantBrandingModel.findOne({ tenantId });
    if (existing) {
      return res.status(400).json({ success: false, error: "Branding profile already exists for this tenant" });
    }

    const branding = await TenantBrandingModel.create({
      tenantId,
      businessName,
      logoUrl: logoUrl || "",
      faviconUrl: faviconUrl || "",
      gstNumber: gstNumber || "",
      gstState: gstState || "",
      invoicePrefix: invoicePrefix || "",
      invoiceFooter: invoiceFooter || "",
      invoiceTerms: invoiceTerms || "",
      isActive: true
    });

    await logBrandingAction(tenantId, String(req.user?.email), "CREATE_BRANDING", `Created branding profile with business name: ${businessName}`);

    return res.status(201).json({ success: true, data: branding });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/settings/tenant-branding ────────────────────────────────────────
export const updateTenantBranding = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { businessName, logoUrl, faviconUrl, gstNumber, gstState, invoicePrefix, invoiceFooter, invoiceTerms } = req.body;

    if (gstNumber && gstNumber.trim() !== "" && !GSTIN_REGEX.test(gstNumber.trim())) {
      return res.status(400).json({ success: false, error: "Invalid GST number format" });
    }

    let branding = await TenantBrandingModel.findOne({ tenantId });

    if (!branding) {
      branding = new TenantBrandingModel({ tenantId, businessName: businessName || "Aura Jewel Store" });
    }

    if (businessName !== undefined) branding.businessName = businessName;
    if (logoUrl !== undefined) branding.logoUrl = logoUrl;
    if (faviconUrl !== undefined) branding.faviconUrl = faviconUrl;
    if (gstNumber !== undefined) branding.gstNumber = gstNumber;
    if (gstState !== undefined) branding.gstState = gstState;
    if (invoicePrefix !== undefined) branding.invoicePrefix = invoicePrefix;
    if (invoiceFooter !== undefined) branding.invoiceFooter = invoiceFooter;
    if (invoiceTerms !== undefined) branding.invoiceTerms = invoiceTerms;

    await branding.save();

    await logBrandingAction(tenantId, String(req.user?.email), "UPDATE_BRANDING", `Updated branding profile settings.`);

    return res.json({ success: true, data: branding });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/tenant-branding/logo ──────────────────────────────────
export const uploadBrandingLogo = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { logoUrl } = req.body;

    if (!logoUrl) {
      return res.status(400).json({ success: false, error: "logoUrl is required" });
    }

    let branding = await TenantBrandingModel.findOne({ tenantId });
    if (!branding) {
      branding = new TenantBrandingModel({ tenantId, businessName: "Aura Jewel Store" });
    }

    branding.logoUrl = logoUrl;
    await branding.save();

    await logBrandingAction(tenantId, String(req.user?.email), "UPDATE_LOGO", `Updated branding logo URL to: ${logoUrl}`);

    return res.json({ success: true, data: branding });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/tenant-branding/favicon ───────────────────────────────
export const uploadBrandingFavicon = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    const { faviconUrl } = req.body;

    if (!faviconUrl) {
      return res.status(400).json({ success: false, error: "faviconUrl is required" });
    }

    let branding = await TenantBrandingModel.findOne({ tenantId });
    if (!branding) {
      branding = new TenantBrandingModel({ tenantId, businessName: "Aura Jewel Store" });
    }

    branding.faviconUrl = faviconUrl;
    await branding.save();

    await logBrandingAction(tenantId, String(req.user?.email), "UPDATE_FAVICON", `Updated branding favicon URL to: ${faviconUrl}`);

    return res.json({ success: true, data: branding });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
