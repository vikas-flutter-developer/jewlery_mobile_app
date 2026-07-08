import { Request, Response } from "express";
import { AuthRequest, decodeToken, findAnyUserById, getClientIp } from "../../../lib/authUtils.js";
import { readSettings, writeSettings } from "../../../lib/settingsStore.js";
import { listSecurityEvents, logSecurityEvent } from "../../../lib/securityAudit.js";

const validateSecuritySettingsPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return true;
};

export const getSecurityOverview = async (req: AuthRequest, res: Response) => {
  try {
    const settingsDoc = await readSettings();
    const securitySettings = (settingsDoc.settings?.security || {}) as Record<string, unknown>;

    let currentSessionJti: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const decoded: any = decodeToken(authHeader.substring(7));
      currentSessionJti = decoded?.jti || null;
    }

    const user = req.user ? await findAnyUserById(req.user.id) : null;
    const sessions = Array.isArray(user?.sessions) ? user.sessions : [];

    const enrichedSessions = sessions.map((session: any) => ({
      ...session,
      currentSession: session.jti === currentSessionJti,
    }));

    const events = await listSecurityEvents({ actor: req.user?.email, limit: 20 });

    return res.json({
      success: true,
      data: {
        securitySettings,
        currentUser: {
          id: req.user?.id,
          email: req.user?.email,
          role: req.user?.role,
          failedLoginAttempts: user?.failedLoginAttempts || 0,
          lockoutUntil: user?.lockoutUntil || null,
        },
        clientIp: getClientIp(req),
        activeSessions: enrichedSessions,
        recentSecurityEvents: events,
      },
    });
  } catch (error: any) {
    console.error("Failed to build security overview", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to build security overview" });
  }
};

export const getSecuritySettings = async (_req: Request, res: Response) => {
  try {
    const settingsDoc = await readSettings();
    return res.json({
      success: true,
      data: settingsDoc.settings?.security || {},
    });
  } catch (error: any) {
    console.error("Failed to read security settings", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to read security settings" });
  }
};

export const updateSecuritySettings = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!validateSecuritySettingsPayload(payload)) {
      return res.status(400).json({ success: false, error: "Invalid security settings payload" });
    }

    const settingsDoc = await readSettings();
    const updatedSettings = {
      ...settingsDoc.settings,
      security: {
        ...((settingsDoc.settings?.security || {}) as Record<string, unknown>),
        ...payload,
      },
    };

    const saved = await writeSettings(updatedSettings);
    await logSecurityEvent(
      (req as AuthRequest).user?.email || "system",
      "update-security-settings",
      (req as AuthRequest).user?.id || "system",
      "Updated security settings"
    );

    return res.json({ success: true, data: saved.settings.security || {} });
  } catch (error: any) {
    console.error("Failed to update security settings", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update security settings" });
  }
};

export const listSecurityEventsEndpoint = async (req: Request, res: Response) => {
  try {
    const actor = typeof req.query.actor === "string" ? req.query.actor : undefined;
    const limit = Number(req.query.limit || 50);
    const events = await listSecurityEvents({ actor, limit });
    return res.json({ success: true, data: events });
  } catch (error: any) {
    console.error("Failed to fetch security events", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch security events" });
  }
};
