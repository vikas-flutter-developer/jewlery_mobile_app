import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import User from "../models/User.ts";
import { readPlatformStore } from "./platformStore.js";
import { readSettings } from "./settingsStore.ts";
import { recordRateLimit } from "./rateLimiter.ts";
import { ManufacturerUser } from "../manufacturer/models/index.js";
import { User as RetailerUser } from "../retailer/models/index.js";
import { SuperAdminUser } from "../superadmin/models/index.js";

const getJwtSecret = () => process.env.JWT_SECRET || "aurajewel_secret_key_2026";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";
const DEFAULT_SESSION_IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_TIMEOUT_MS || 30 * 60 * 1000); // 30 minutes default
const DEFAULT_MAX_FAILED_ATTEMPTS = Number(process.env.MAX_FAILED_ATTEMPTS || 5);
const DEFAULT_LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 15);
const DEFAULT_LOGIN_RATE_LIMIT = Number(process.env.LOGIN_RATE_LIMIT || 10);
const DEFAULT_LOGIN_RATE_WINDOW_MS = Number(process.env.LOGIN_RATE_WINDOW_MS || 60 * 1000);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    branchId?: string;
    tenantId?: string | null;
    storeType?: string;
  };
}

export const generateToken = (userId: string, email: string, role: string, branchId?: string, tenantId?: string | null, storeType?: string) => {
  return jwt.sign({ id: userId, email, role, branchId, tenantId, storeType }, getJwtSecret(), { expiresIn: JWT_EXPIRY });
};

const parseExpiryToSeconds = (v: string) => {
  try {
    if (/^\d+$/.test(v)) return Number(v);
    const m = v.match(/^(\d+)([smhd])$/);
    if (!m) return 7 * 24 * 3600;
    const n = Number(m[1]);
    const u = m[2];
    if (u === "s") return n;
    if (u === "m") return n * 60;
    if (u === "h") return n * 3600;
    if (u === "d") return n * 24 * 3600;
    return n;
  } catch (e) {
    return 7 * 24 * 3600;
  }
};

const getSecuritySettings = async () => {
  try {
    const settingsDoc = await readSettings();
    return (settingsDoc.settings?.security || {}) as Record<string, unknown>;
  } catch (error) {
    return {};
  }
};

export const getClientIp = (req: Request) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || req.ip || "";
};

export const decodeToken = (token: string) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (_error) {
    return null;
  }
};

export const findAnyUserById = async (userId: string) => {
  if (!userId) return null;
  try {
    let u = await User.findOne({ _id: userId } as any);
    if (u) return u;
  } catch (_e) {}
  try {
    let u = await ManufacturerUser.findOne({ _id: userId } as any);
    if (u) return u;
  } catch (_e) {}
  try {
    let u = await RetailerUser.findOne({ _id: userId } as any);
    if (u) return u;
  } catch (_e) {}
  try {
    let u = await SuperAdminUser.findOne({ _id: userId } as any);
    if (u) return u;
  } catch (_e) {}
  return null;
};

export const getLockoutConfig = async () => {
  const security = await getSecuritySettings();
  const maxAttempts = typeof security.maxFailedAttempts === "number" ? security.maxFailedAttempts : DEFAULT_MAX_FAILED_ATTEMPTS;
  const lockoutMinutes = typeof security.lockoutMinutes === "number" ? security.lockoutMinutes : DEFAULT_LOCKOUT_MINUTES;
  return { maxAttempts, lockoutMinutes };
};

export const getSessionIdleTimeoutMs = async () => {
  const security = await getSecuritySettings();
  const configured = typeof security.sessionIdleTimeoutMs === "number" ? security.sessionIdleTimeoutMs : DEFAULT_SESSION_IDLE_TIMEOUT_MS;
  return configured;
};

export const getGlobalIpWhitelist = async () => {
  const security = await getSecuritySettings();
  if (Array.isArray(security.ipWhitelist)) {
    return security.ipWhitelist.filter((item: any) => typeof item === "string").map((item: string) => item.trim()).filter(Boolean);
  }
  const envValue = process.env.IP_WHITELIST || "";
  return envValue.split(",").map((s) => s.trim()).filter(Boolean);
};

export const getLoginRateLimitConfig = async () => {
  const security = await getSecuritySettings();
  const maxRequests = typeof security.loginRateLimit === "number" ? security.loginRateLimit : DEFAULT_LOGIN_RATE_LIMIT;
  const windowMs = typeof security.loginRateWindowMs === "number" ? security.loginRateWindowMs : DEFAULT_LOGIN_RATE_WINDOW_MS;
  return { maxRequests, windowMs };
};

export const shouldAllowLoginAttempt = async (req: Request) => {
  const { maxRequests, windowMs } = await getLoginRateLimitConfig();
  const key = `login:${getClientIp(req)}`;
  return recordRateLimit(key, maxRequests, windowMs);
};

export const createSessionToken = async (userId: string, email: string, role: string, branchId?: string, tenantId?: string | null, ip?: string, device?: string, storeType?: string) => {
  const jti = randomUUID();
  const payload: any = { id: userId, email, role, branchId, tenantId, storeType, jti };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
  const expiresInSec = parseExpiryToSeconds(JWT_EXPIRY.replace(/\s+/g, ""));
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  // attach session to user if possible
  try {
    const u = await User.findOne({ _id: userId } as any);
    if (u) {
      u.sessions = u.sessions || [];
      u.sessions.push({ jti, createdAt: new Date(), lastSeenAt: new Date(), expiresAt, ip: ip || "", device: device || "" });
      await u.save();
    }
  } catch (e) {
    // ignore if DB not available
  }

  return { token, jti, expiresAt };
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

export const revokeSession = async (userId: string, jti: string) => {
  try {
    const u = await User.findOne({ _id: userId } as any);
    if (!u) return false;
    u.sessions = (u.sessions || []).filter((s: any) => s.jti !== jti);
    await u.save();
    return true;
  } catch (e) {
    return false;
  }
};

export const generateApiKey = (userId: string, email: string, role: string, branchId?: string, tenantId?: string | null, storeType?: string) => {
  const expiresIn = process.env.API_KEY_EXPIRY || "30d";
  return jwt.sign({ id: userId, email, role, branchId, tenantId, storeType, apiAccess: true }, getJwtSecret(), { expiresIn });
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded: any = verifyToken(token);

    if (!decoded || !decoded.id) {
      console.error("Auth Middleware: Decoded token missing id field", decoded);
      return res.status(401).json({ error: "Authentication failed: invalid token payload" });
    }

    if (decoded.tenantId) {
      try {
        const platform = await readPlatformStore();
        const store = platform.stores.find((s) => s.id === decoded.tenantId);
        if (!store) {
          // Store was deleted by super admin — revoke access immediately
          return res.status(401).json({ error: "Your subscription has been removed. Please contact admin." });
        }
        if (store.status === "SUSPENDED") {
          return res.status(401).json({ error: "Subscription suspended. Please contact admin at 7558556969 to resume subscription." });
        }
        if (store.status === "EXPIRED") {
          return res.status(401).json({ error: "Your subscription has expired. Please renew to continue." });
        }
      } catch (err) {
        console.error("Failed to verify store status in authMiddleware", err);
      }
    }

    // attempt to enforce session presence if DB available
    try {
      const u = await User.findOne({ _id: decoded.id } as any);
      if (u) {
        if (u.status === "BLOCKED") {
          return res.status(403).json({ error: "Your account has been blocked. Please contact administration." });
        }
        if (u.status === "INACTIVE") {
          return res.status(403).json({ error: "Your account is inactive. Please contact administration." });
        }
        if (u.passwordResetRequired && !req.originalUrl.includes("/change-password") && !req.originalUrl.includes("/logout")) {
          return res.status(403).json({ error: "Password reset required", passwordResetRequired: true });
        }
        const jti = decoded.jti;
        const sessions = u.sessions || [];
        const session = sessions.find((s: any) => s.jti === jti);
        if (!session) {
          console.warn(`Auth Middleware: Session not found in DB for user ${decoded.id}, jti: ${jti}`);
          return res.status(401).json({ error: "Session invalid or revoked" });
        }
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          console.warn(`Auth Middleware: Session expired for user ${decoded.id}, jti: ${jti}`);
          // remove expired session
          u.sessions = sessions.filter((s: any) => s.jti !== jti);
          await u.save();
          return res.status(401).json({ error: "Session expired" });
        }
        // idle timeout enforcement
        const sessionIdleTimeoutMs = await getSessionIdleTimeoutMs();
        if (sessionIdleTimeoutMs > 0 && session.lastSeenAt) {
          const last = new Date(session.lastSeenAt).getTime();
          if (Date.now() - last > sessionIdleTimeoutMs) {
            console.warn(`Auth Middleware: Session idle timeout reached for user ${decoded.id}, jti: ${jti}`);
            u.sessions = sessions.filter((s: any) => s.jti !== jti);
            await u.save();
            return res.status(401).json({ error: "Session timed out due to inactivity" });
          }
        }
        // update lastSeenAt
        session.lastSeenAt = new Date();
        await u.save();
      }
    } catch (e: any) {
      console.error("Auth Middleware database check error (ignored):", e);
      // ignore DB errors and allow token if valid
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      branchId: decoded.branchId,
      tenantId: decoded.tenantId,
      storeType: decoded.storeType || (decoded.role === "RETAILER" ? "RETAILER" : decoded.role === "ADMIN" ? "MANUFACTURER" : "RETAILER")
    };

    next();
  } catch (error: any) {
    console.error("Auth Middleware Error:", error);
    res.status(401).json({ error: `Authentication failed: ${error.message || error}` });
  }
};

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

export const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await readPlatformStore();
    if (document.featureFlags?.maintenanceMode) {
      // 1. Allow login requests and super admin endpoints to bypass
      const isBypassRoute = req.originalUrl.includes("/api/auth/login") || req.originalUrl.includes("/api/super-admin");
      if (isBypassRoute) {
        return next();
      }

      // 2. Decode the token if present to check if user is SUPER_ADMIN
      let isSuperAdminUser = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          const decoded: any = jwt.verify(token, getJwtSecret());
          if (decoded && decoded.role === "SUPER_ADMIN") {
            isSuperAdminUser = true;
          }
        } catch {
          // Token invalid/expired - let it be handled by authMiddleware down the road
        }
      }

      if (!isSuperAdminUser) {
        return res.status(503).json({
          success: false,
          error: "Platform is currently undergoing maintenance. Please try again later.",
          maintenanceMode: true
        });
      }
    }
  } catch (error) {
    console.error("Maintenance check failed, allowing request by default", error);
  }
  next();
};
