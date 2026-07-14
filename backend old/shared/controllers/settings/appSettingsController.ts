import { Request, Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  TenantAppSettings as TenantAppSettingsModel,
  TenantTheme as TenantThemeModel,
  TenantDomain as TenantDomainModel
} from "../../../retailer/models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Helper to log user action audits
const logAppAction = async (tenantId: string, actor: string, action: string, details: string) => {
  try {
    if (isDbConnected()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "TenantAppSettings",
        entityId: tenantId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write app settings audit log:", err);
  }
};

const isAuthorized = (req: AuthRequest) => {
  return req.user?.role === "ADMIN" || req.user?.role === "SUPER_ADMIN";
};

// ─── GET /api/settings/app-settings ───────────────────────────────────
export const getTenantAppSettings = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || "default-shop";
    let settings = await TenantAppSettingsModel.findOne({ tenantId, isActive: true }).lean();
    if (!settings) {
      // Return a blank default profile so frontend loads cleanly
      settings = {
        tenantId,
        appName: "AuraJewel Shop",
        appIconUrl: "",
        splashScreenUrl: "",
        isActive: true
      };
    }
    return res.json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/app-settings ──────────────────────────────────
export const createTenantAppSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage app settings" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { appName, appIconUrl, splashScreenUrl, isActive } = req.body;

    if (!appName) {
      return res.status(400).json({ success: false, error: "appName is required" });
    }

    const activeVal = isActive !== undefined ? isActive : true;

    if (activeVal) {
      await TenantAppSettingsModel.updateMany({ tenantId }, { isActive: false });
    }

    const settings = await TenantAppSettingsModel.create({
      tenantId,
      appName,
      appIconUrl: appIconUrl || "",
      splashScreenUrl: splashScreenUrl || "",
      isActive: activeVal
    });

    await logAppAction(tenantId, String(req.user?.email), "CREATE_APP_SETTINGS", `Created app settings for app name: ${appName}`);

    return res.status(201).json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── PUT /api/settings/app-settings ───────────────────────────────────
export const updateTenantAppSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage app settings" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { appName, appIconUrl, splashScreenUrl, isActive } = req.body;

    let settings = await TenantAppSettingsModel.findOne({ tenantId, isActive: true });
    if (!settings) {
      settings = new TenantAppSettingsModel({ tenantId, isActive: true });
    }

    if (appName !== undefined) settings.appName = appName;
    if (appIconUrl !== undefined) settings.appIconUrl = appIconUrl;
    if (splashScreenUrl !== undefined) settings.splashScreenUrl = splashScreenUrl;
    if (isActive !== undefined) settings.isActive = isActive;

    await settings.save();

    await logAppAction(tenantId, String(req.user?.email), "UPDATE_APP_SETTINGS", `Updated app settings for app name: ${settings.appName}`);

    return res.json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/app-settings/icon ─────────────────────────────
export const uploadAppIcon = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage app settings" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { appIconUrl } = req.body;

    if (!appIconUrl) {
      return res.status(400).json({ success: false, error: "appIconUrl is required" });
    }

    let settings = await TenantAppSettingsModel.findOne({ tenantId, isActive: true });
    if (!settings) {
      settings = new TenantAppSettingsModel({ tenantId, appName: "AuraJewel Shop", isActive: true });
    }

    settings.appIconUrl = appIconUrl;
    await settings.save();

    await logAppAction(tenantId, String(req.user?.email), "UPDATE_APP_ICON", `Uploaded app icon`);

    return res.json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── POST /api/settings/app-settings/splash ───────────────────────────
export const uploadAppSplash = async (req: AuthRequest, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to manage app settings" });
    }

    const tenantId = req.user?.tenantId || "default-shop";
    const { splashScreenUrl } = req.body;

    if (!splashScreenUrl) {
      return res.status(400).json({ success: false, error: "splashScreenUrl is required" });
    }

    let settings = await TenantAppSettingsModel.findOne({ tenantId, isActive: true });
    if (!settings) {
      settings = new TenantAppSettingsModel({ tenantId, appName: "AuraJewel Shop", isActive: true });
    }

    settings.splashScreenUrl = splashScreenUrl;
    await settings.save();

    await logAppAction(tenantId, String(req.user?.email), "UPDATE_APP_SPLASH", `Uploaded app splash screen`);

    return res.json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/settings/app-settings/manifest ──────────────────────────
export const getPwaManifest = async (req: Request, res: Response) => {
  try {
    let tenantId = "default-shop";

    // Resolve tenant from header, host mapping, or queries
    if (req.headers["x-tenant-id"]) {
      tenantId = req.headers["x-tenant-id"] as string;
    } else if (req.query.tenantId) {
      tenantId = req.query.tenantId as string;
    } else {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      if (host) {
        const domainName = (host as string).split(":")[0].toLowerCase();
        const exemptDomains = ["localhost", "127.0.0.1", "aurajewel.com"];
        if (!exemptDomains.includes(domainName)) {
          const mapping = await TenantDomainModel.findOne({ domain: domainName, status: "VERIFIED" }).lean();
          if (mapping && mapping.tenantId) {
            tenantId = mapping.tenantId;
          }
        }
      }
    }

    // Load active settings and themes
    const appSettings = await TenantAppSettingsModel.findOne({ tenantId, isActive: true }).lean();
    const theme = await TenantThemeModel.findOne({ tenantId, isActive: true }).lean();

    const appName = appSettings?.appName || "AuraJewel Store";
    const appIcon = appSettings?.appIconUrl || "/icon-192.svg";
    const themeColor = theme?.primaryColor || "#0f172a";

    const manifest = {
      name: appName,
      short_name: appName.slice(0, 12),
      description: `White-labeled portal for ${appName}`,
      icons: [
        {
          src: appIcon,
          sizes: "192x192",
          type: appIcon.endsWith(".svg") ? "image/svg+xml" : "image/png",
          purpose: "any maskable"
        },
        {
          src: appSettings?.splashScreenUrl || appIcon,
          sizes: "512x512",
          type: appIcon.endsWith(".svg") ? "image/svg+xml" : "image/png",
          purpose: "any maskable"
        }
      ],
      start_url: "/?utm_source=pwa",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: themeColor,
      orientation: "portrait"
    };

    res.setHeader("Content-Type", "application/json");
    return res.json(manifest);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
