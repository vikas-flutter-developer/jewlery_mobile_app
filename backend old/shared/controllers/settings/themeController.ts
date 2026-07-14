import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { TenantTheme as TenantThemeModel } from "../../../retailer/models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected, tenantLocalStorage } from "../../../lib/db.js";

// Helper to log user action audits
const logThemeAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "TenantTheme",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write theme audit log:", err);
  }
};

const COLOR_REGEX = /^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
const isValidColor = (color: string) => {
  if (!color) return false;
  return COLOR_REGEX.test(color);
};

// Check if role is ADMIN or SUPER_ADMIN
const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/settings/theme ────────────────────────────────────────
export const getTenantTheme = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || tenantLocalStorage.getStore()?.tenantId || "default-shop";
    let theme = await TenantThemeModel.findOne({ tenantId, isActive: true }).lean();

    if (!theme) {
      theme = {
        tenantId,
        primaryColor: "#0f172a",
        secondaryColor: "#475569",
        accentColor: "#fbbf24",
        loginBannerUrl: "",
        loginBackgroundUrl: "",
        isActive: true
      };
    }

    return res.json({ success: true, data: theme });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/theme ───────────────────────────────────────
export const createTenantTheme = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage themes" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { primaryColor, secondaryColor, accentColor, loginBannerUrl, loginBackgroundUrl, isActive } = req.body;

    if (primaryColor && !isValidColor(primaryColor)) {
      return res.status(400).json({ success: false, error: "Invalid primary color hex value" });
    }
    if (secondaryColor && !isValidColor(secondaryColor)) {
      return res.status(400).json({ success: false, error: "Invalid secondary color hex value" });
    }
    if (accentColor && !isValidColor(accentColor)) {
      return res.status(400).json({ success: false, error: "Invalid accent color hex value" });
    }

    // Enforce one active theme rule
    const activeVal = isActive !== undefined ? isActive : true;
    if (activeVal) {
      await TenantThemeModel.updateMany({ tenantId }, { isActive: false });
    }

    const theme = await TenantThemeModel.create({
      tenantId,
      primaryColor: primaryColor || "#0f172a",
      secondaryColor: secondaryColor || "#475569",
      accentColor: accentColor || "#fbbf24",
      loginBannerUrl: loginBannerUrl || "",
      loginBackgroundUrl: loginBackgroundUrl || "",
      isActive: activeVal
    });

    await logThemeAction(tenantId, String(req.user?.email), "CREATE_THEME", `Created theme configuration.`);

    return res.status(201).json({ success: true, data: theme });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/settings/theme ────────────────────────────────────────
export const updateTenantTheme = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage themes" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { primaryColor, secondaryColor, accentColor, loginBannerUrl, loginBackgroundUrl, isActive } = req.body;

    if (primaryColor && !isValidColor(primaryColor)) {
      return res.status(400).json({ success: false, error: "Invalid primary color hex value" });
    }
    if (secondaryColor && !isValidColor(secondaryColor)) {
      return res.status(400).json({ success: false, error: "Invalid secondary color hex value" });
    }
    if (accentColor && !isValidColor(accentColor)) {
      return res.status(400).json({ success: false, error: "Invalid accent color hex value" });
    }

    // Enforce one active theme rule
    const activeVal = isActive !== undefined ? isActive : true;
    if (activeVal) {
      await TenantThemeModel.updateMany({ tenantId }, { isActive: false });
    }

    let theme = await TenantThemeModel.findOne({ tenantId });
    if (!theme) {
      theme = new TenantThemeModel({ tenantId });
    }

    if (primaryColor !== undefined) theme.primaryColor = primaryColor;
    if (secondaryColor !== undefined) theme.secondaryColor = secondaryColor;
    if (accentColor !== undefined) theme.accentColor = accentColor;
    if (loginBannerUrl !== undefined) theme.loginBannerUrl = loginBannerUrl;
    if (loginBackgroundUrl !== undefined) theme.loginBackgroundUrl = loginBackgroundUrl;
    theme.isActive = activeVal;

    await theme.save();

    await logThemeAction(tenantId, String(req.user?.email), "UPDATE_THEME", `Updated theme configuration.`);

    return res.json({ success: true, data: theme });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/theme/login-banner ──────────────────────────────────
export const uploadLoginBanner = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage themes" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { loginBannerUrl } = req.body;

    if (!loginBannerUrl) {
      return res.status(400).json({ success: false, error: "loginBannerUrl is required" });
    }

    let theme = await TenantThemeModel.findOne({ tenantId, isActive: true });
    if (!theme) {
      theme = new TenantThemeModel({ tenantId, isActive: true });
    }

    theme.loginBannerUrl = loginBannerUrl;
    await theme.save();

    await logThemeAction(tenantId, String(req.user?.email), "UPDATE_THEME_BANNER", `Updated login banner to: ${loginBannerUrl}`);

    return res.json({ success: true, data: theme });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/theme/login-background ───────────────────────────────
export const uploadLoginBackground = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage themes" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { loginBackgroundUrl } = req.body;

    if (!loginBackgroundUrl) {
      return res.status(400).json({ success: false, error: "loginBackgroundUrl is required" });
    }

    let theme = await TenantThemeModel.findOne({ tenantId, isActive: true });
    if (!theme) {
      theme = new TenantThemeModel({ tenantId, isActive: true });
    }

    theme.loginBackgroundUrl = loginBackgroundUrl;
    await theme.save();

    await logThemeAction(tenantId, String(req.user?.email), "UPDATE_THEME_BACKGROUND", `Updated login background to: ${loginBackgroundUrl}`);

    return res.json({ success: true, data: theme });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
