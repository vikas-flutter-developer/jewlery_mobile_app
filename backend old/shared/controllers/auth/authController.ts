import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../../../models/User.js";
import Karikar from "../../../models/Karikar.js";
import { ManufacturerUser } from "../../../manufacturer/models/index.js";
import { User as RetailerUser } from "../../../retailer/models/index.js";
import { SuperAdminSubscription as Subscription, SuperAdminUser } from "../../../superadmin/models/index.js";
import { mockKarikars } from "../../../data/mockData.js";
import { generateToken, generateApiKey, AuthRequest, createSessionToken, revokeSession, shouldAllowLoginAttempt, getLockoutConfig, getGlobalIpWhitelist, getClientIp } from "../../../lib/authUtils.js";
import { logSecurityEvent } from "../../../lib/securityAudit.js";
import Branch from "../../../models/Branch.js";
import otpService from "../../../lib/otpService.js";
import { readPlatformStore } from "../../../lib/platformStore.js";
import {
  addFallbackShop,
  addFallbackUser,
  findFallbackShopById,
  findFallbackUserByEmail,
  findFallbackUserById,
  findFallbackUserByPhone,
  updateFallbackUser,
  FallbackUser,
} from "../../../lib/fallbackStore.js";

const dummyRetailerEmail = "retailer@aurajewel.com";
const dummyRetailerPassword = "retailer";



export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const rateResult = await shouldAllowLoginAttempt(req);
    if (!rateResult.allowed) {
      await logSecurityEvent(email || "unknown", "login-rate-limit", email || getClientIp(req), `Rate limit exceeded from ${getClientIp(req)}`);
      return res.status(429).json({ error: "Too many login attempts. Please wait before retrying.", retryAfterMs: rateResult.retryAfterMs });
    }

    const dummyAdminEmail = process.env.ADMIN_EMAIL || "manufacturer@aurajewel.com";
    const dummyAdminPassword = process.env.ADMIN_PASSWORD || "manufacturer";
    const dbReady = mongoose.connection.readyState === 1;

    let user: any = null;
    let isDummyAdmin = false;
    let storeType = "RETAILER";
    if (dbReady) {
      // Prioritize active subscriptions to route email properly (e.g. if email exists as sales staff elsewhere)
      let emailSubscription: any = null;
      try {
        emailSubscription = await Subscription.findOne({ email, status: "ACTIVE" }).lean();
      } catch (e) {}

      if (emailSubscription) {
        const preferredStoreType = emailSubscription.storeType;
        if (preferredStoreType === "MANUFACTURER") {
          try {
            const mUser = await ManufacturerUser.findOne({ email } as any);
            if (mUser) {
              user = mUser;
              storeType = "MANUFACTURER";
            }
          } catch (e) {}
        } else if (preferredStoreType === "RETAILER") {
          try {
            const rUser = await RetailerUser.findOne({ email } as any);
            if (rUser) {
              user = rUser;
              storeType = "RETAILER";
            }
          } catch (e) {}
        }
      }

      if (!user) {
        user = await User.findOne({ email } as any);
        if (user) {
          storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
        }
      }

      if (!user) {
        try {
          const mUser = await ManufacturerUser.findOne({ email } as any);
          if (mUser) {
            user = mUser;
            storeType = "MANUFACTURER";
          }
        } catch (e) {}
      }

      if (!user) {
        try {
          const rUser = await RetailerUser.findOne({ email } as any);
          if (rUser) {
            user = rUser;
            storeType = "RETAILER";
          }
        } catch (e) {}
      }

      if (!user) {
        try {
          const saUser = await SuperAdminUser.findOne({ email } as any);
          if (saUser) {
            user = saUser;
            storeType = "SUPER_ADMIN";
          }
        } catch (e) {}
      }

      if (!user) {
        const karikar = await Karikar.findOne({ email } as any);
        if (karikar) {
          user = {
            _id: karikar._id,
            email: karikar.email,
            name: karikar.name,
            role: "KARIKAR",
            password: karikar.password,
            branchId: null,
            phone: null,
            tenantId: "default-shop"
          };
          storeType = "RETAILER";
        }
      }

      // Check fallbackStore as a last resort in case store was created offline
      if (!user) {
        user = await findFallbackUserByEmail(email);
        if (user) {
          storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
        }
      }
    } else {
      let emailSubscription: any = null;
      try {
        const platform = await readPlatformStore();
        emailSubscription = platform.stores.find(s => s.email?.toLowerCase() === email.toLowerCase() && s.status === "ACTIVE");
      } catch (e) {}

      if (emailSubscription) {
        const preferredStoreType = emailSubscription.storeType;
        user = await findFallbackUserByEmail(email);
        if (user) {
          storeType = preferredStoreType === "MANUFACTURER" ? "MANUFACTURER" : "RETAILER";
        }
      }

      if (!user) {
        user = await findFallbackUserByEmail(email);
        if (user) {
          storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
        }
      }

      if (!user) {
        const karikar = mockKarikars.find((k: any) => k.email?.toLowerCase() === email.toLowerCase());
        if (karikar) {
          user = {
            _id: karikar._id,
            email: karikar.email,
            name: karikar.name,
            role: "KARIKAR",
            password: karikar.password,
            branchId: null,
            phone: null,
            tenantId: "default-shop"
          };
          storeType = "RETAILER";
        }
      }
    }

    if (!user && email === dummyAdminEmail && password === dummyAdminPassword) {
      isDummyAdmin = true;
      user = {
        _id: "admin-fallback",
        email: dummyAdminEmail,
        name: "System Admin",
        role: "ADMIN",
        branchId: null,
        phone: null,
        password: dummyAdminPassword,
        lastLogin: new Date()
      } as any;
      storeType = "MANUFACTURER";
    }

    if (!user && email === dummyRetailerEmail && password === dummyRetailerPassword) {
      user = {
        _id: "retailer-fallback",
        email: dummyRetailerEmail,
        name: "System Retailer",
        role: "RETAILER",
        branchId: null,
        phone: null,
        password: dummyRetailerPassword,
        tenantId: "default-shop",
        lastLogin: new Date()
      } as any;
      storeType = "RETAILER";
    }

    if (!user || !user.password) {
      if (!dbReady) {
        return res.status(503).json({ error: "Database unavailable. Use manufacturer@aurajewel.com / manufacturer or retailer@aurajewel.com / retailer for offline access." });
      }
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // lockout check
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      await logSecurityEvent(user.email || email, "login-locked", user._id?.toString() || email, `Login blocked: account locked until ${user.lockoutUntil}`);
      return res.status(423).json({ error: "Account locked due to multiple failed login attempts. Try later." });
    }

    const isPasswordValid = isDummyAdmin 
      ? password === dummyAdminPassword 
      : (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))
        ? await bcrypt.compare(password, user.password)
        : password === user.password;
    if (!isPasswordValid) {
      // increment failed attempts
      try {
        const { maxAttempts, lockoutMinutes } = await getLockoutConfig();
        if (typeof user.save === 'function') {
          user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
          if (user.failedLoginAttempts >= maxAttempts) {
            user.lockoutUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
            await logSecurityEvent(user.email || email, "account-lockout", user._id?.toString() || email, `Account locked after ${user.failedLoginAttempts} failed login attempts`);
          }
          await user.save();
        }
      } catch (e) {}
      await logSecurityEvent(email, "failed-login", user._id?.toString() || email, `Failed login attempt from IP ${getClientIp(req)}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status === "BLOCKED") {
      await logSecurityEvent(user.email || email, "login-blocked", user._id?.toString() || email, `Blocked user attempted login`);
      return res.status(403).json({ error: "Your account has been blocked. Please contact administration." });
    }
    if (user.status === "INACTIVE") {
      await logSecurityEvent(user.email || email, "login-inactive", user._id?.toString() || email, `Inactive user attempted login`);
      return res.status(403).json({ error: "Your account is inactive. Please contact administration." });
    }

    if (user.tenantId) {
      try {
        const platform = await readPlatformStore();
        let store = platform.stores.find((s) => s.id === user.tenantId);
        if (!store && dbReady) {
          const dbStore = await Subscription.findOne({ id: user.tenantId }).lean();
          if (dbStore) {
            store = dbStore as any;
          }
        }
        if (!store) {
          return res.status(401).json({ error: "Your subscription has been deleted. Please contact support." });
        }
        if (store.status === "SUSPENDED") {
          return res.status(401).json({ error: "Your subscription is suspended. Please contact admin at 7558556969 to resume your subscription." });
        }
      } catch (err) {
        console.error("Failed to check store status during login", err);
      }
    }

    const isOtpRequired = (user.role && (user.role.toUpperCase() === "ADMIN" || user.role.toUpperCase() === "RETAILER")) || (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL === email);

    // IP whitelist enforcement (branch-level or global)
    const reqIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '').toString();
    try {
      const branch = user.branchId ? await Branch.findOne({ $or: [{ _id: user.branchId }, { code: user.branchId }] } as any) : null;
      const branchWhitelist = branch && branch.ipWhitelist && branch.ipWhitelist.length ? branch.ipWhitelist : null;
      const globalWhitelist = await getGlobalIpWhitelist();
      const whitelist = branchWhitelist || globalWhitelist;
      if (whitelist && whitelist.length > 0) {
        const ipOk = whitelist.includes(reqIp) || whitelist.includes(reqIp.replace('::ffff:', ''));
        if (!ipOk) {
          await logSecurityEvent(user.email || email, "ip-whitelist-block", user._id?.toString() || email, `Login attempt from ${reqIp} blocked by IP whitelist`);
          return res.status(403).json({ error: 'Login not allowed from this IP for the store' });
        }
      }
    } catch (e) {}

    if (isOtpRequired) {
      if (user.email) {
        await otpService.sendOtpToEmail(user.email);
        return res.json({ success: true, requireOtp: true, via: 'email', message: 'OTP sent to email' });
      }
      if (user.phone) {
        await otpService.sendOtpToPhone(user.phone);
        return res.json({ success: true, requireOtp: true, via: 'phone', message: 'OTP sent to phone' });
      }
      return res.status(400).json({ error: 'Account has no contact to send OTP' });
    }
    // successful login: reset failed attempts, create session token
    user.lastLogin = new Date().toISOString();
    if (typeof user.save === 'function') {
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
    }
    const device = req.headers['user-agent'] ? String(req.headers['user-agent']).substr(0, 200) : '';
    const session = await createSessionToken(user._id.toString(), user.email, user.role, user.branchId?.toString(), user.tenantId, reqIp, device, storeType);
    await logSecurityEvent(user.email || email, "login-success", user._id?.toString() || email, `Successful login from IP ${reqIp} device ${device}`);
    if (typeof user.save === 'function') {
      await user.save();
    } else {
      await updateFallbackUser(user);
    }

    res.json({
      success: true,
      message: "Login successful",
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId || null,
        storeType,
        token: session.token,
        jti: session.jti,
        expiresAt: session.expiresAt,
        passwordResetRequired: user.passwordResetRequired || false
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = (req.headers.authorization || '').toString();
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(400).json({ error: 'No token' });
    const token = authHeader.substring(7);
    const decoded: any = generateToken ? undefined : undefined; // placeholder
    // decode without verifying to get jti and id
    let payload: any = null;
    try { payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); } catch (e) { }
    if (!payload || !payload.id || !payload.jti) return res.status(400).json({ error: 'Invalid token' });
    const ok = await revokeSession(payload.id, payload.jti);
    return res.json({ success: ok });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Logout failed' });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, phone, code } = req.body;
    if (!code || (!email && !phone)) {
      return res.status(400).json({ error: 'Provide code and email or phone' });
    }

    let ok = false;
    let user: any = null;
    const dummyAdminEmail = process.env.ADMIN_EMAIL || "manufacturer@aurajewel.com";
    const dummyAdminPassword = process.env.ADMIN_PASSWORD || "manufacturer";

    const dbReady = mongoose.connection.readyState === 1;
    let storeType = "RETAILER";

    if (email) {
      ok = otpService.verifyOtpForEmail(email, code);
      if (dbReady) {
        // Prioritize active subscriptions to route email properly
        let emailSubscription: any = null;
        try {
          emailSubscription = await Subscription.findOne({ email, status: "ACTIVE" }).lean();
        } catch (e) {}

        if (emailSubscription) {
          const preferredStoreType = emailSubscription.storeType;
          if (preferredStoreType === "MANUFACTURER") {
            try {
              const mUser = await ManufacturerUser.findOne({ email } as any);
              if (mUser) {
                user = mUser;
                storeType = "MANUFACTURER";
              }
            } catch (e) {}
          } else if (preferredStoreType === "RETAILER") {
            try {
              const rUser = await RetailerUser.findOne({ email } as any);
              if (rUser) {
                user = rUser;
                storeType = "RETAILER";
              }
            } catch (e) {}
          }
        }

        if (!user) {
          user = await User.findOne({ email } as any);
          if (user) {
            storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
          }
        }
        if (!user) {
          try {
            const mUser = await ManufacturerUser.findOne({ email } as any);
            if (mUser) {
              user = mUser;
              storeType = "MANUFACTURER";
            }
          } catch (e) {}
        }
        if (!user) {
          try {
            const rUser = await RetailerUser.findOne({ email } as any);
            if (rUser) {
              user = rUser;
              storeType = "RETAILER";
            }
          } catch (e) {}
        }
        if (!user) {
          try {
            const saUser = await SuperAdminUser.findOne({ email } as any);
            if (saUser) {
              user = saUser;
              storeType = "SUPER_ADMIN";
            }
          } catch (e) {}
        }
        if (!user) {
          user = await findFallbackUserByEmail(email);
          if (user) {
            storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
          }
        }
      } else {
        let emailSubscription: any = null;
        try {
          const platform = await readPlatformStore();
          emailSubscription = platform.stores.find(s => s.email?.toLowerCase() === email.toLowerCase() && s.status === "ACTIVE");
        } catch (e) {}

        if (emailSubscription) {
          const preferredStoreType = emailSubscription.storeType;
          user = await findFallbackUserByEmail(email);
          if (user) {
            storeType = preferredStoreType === "MANUFACTURER" ? "MANUFACTURER" : "RETAILER";
          }
        }

        if (!user) {
          user = await findFallbackUserByEmail(email);
          if (user) {
            storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
          }
        }
      }
      if (!user && email === dummyAdminEmail) {
        user = {
          _id: "admin-fallback",
          email: dummyAdminEmail,
          name: "System Admin",
          role: "ADMIN",
          branchId: null,
          phone: null,
          password: dummyAdminPassword,
          lastLogin: new Date()
        } as any;
        storeType = "MANUFACTURER";
      }
      if (!user && email === dummyRetailerEmail) {
        user = {
          _id: "retailer-fallback",
          email: dummyRetailerEmail,
          name: "System Retailer",
          role: "RETAILER",
          branchId: null,
          phone: null,
          password: dummyRetailerPassword,
          tenantId: "default-shop",
          lastLogin: new Date()
        } as any;
        storeType = "RETAILER";
      }
    } else if (phone) {
      ok = otpService.verifyOtpForPhone(phone, code);
      if (dbReady) {
        // Prioritize active subscriptions to route phone properly
        let phoneSubscription: any = null;
        try {
          phoneSubscription = await Subscription.findOne({ phone, status: "ACTIVE" }).lean();
        } catch (e) {}

        if (phoneSubscription) {
          const preferredStoreType = phoneSubscription.storeType;
          if (preferredStoreType === "MANUFACTURER") {
            try {
              const mUser = await ManufacturerUser.findOne({ phone } as any);
              if (mUser) {
                user = mUser;
                storeType = "MANUFACTURER";
              }
            } catch (e) {}
          } else if (preferredStoreType === "RETAILER") {
            try {
              const rUser = await RetailerUser.findOne({ phone } as any);
              if (rUser) {
                user = rUser;
                storeType = "RETAILER";
              }
            } catch (e) {}
          }
        }

        if (!user) {
          user = await User.findOne({ phone } as any);
          if (user) {
            storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
          }
        }
        if (!user) {
          try {
            const mUser = await ManufacturerUser.findOne({ phone } as any);
            if (mUser) {
              user = mUser;
              storeType = "MANUFACTURER";
            }
          } catch (e) {}
        }
        if (!user) {
          try {
            const rUser = await RetailerUser.findOne({ phone } as any);
            if (rUser) {
              user = rUser;
              storeType = "RETAILER";
            }
          } catch (e) {}
        }
        if (!user) {
          try {
            const saUser = await SuperAdminUser.findOne({ phone } as any);
            if (saUser) {
              user = saUser;
              storeType = "SUPER_ADMIN";
            }
          } catch (e) {}
        }
        if (!user) {
          user = await findFallbackUserByPhone(phone);
          if (user) {
            storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
          }
        }
      } else {
        let phoneSubscription: any = null;
        try {
          const platform = await readPlatformStore();
          phoneSubscription = platform.stores.find(s => s.phone === phone && s.status === "ACTIVE");
        } catch (e) {}

        if (phoneSubscription) {
          const preferredStoreType = phoneSubscription.storeType;
          user = await findFallbackUserByPhone(phone);
          if (user) {
            storeType = preferredStoreType === "MANUFACTURER" ? "MANUFACTURER" : "RETAILER";
          }
        }

        if (!user) {
          user = await findFallbackUserByPhone(phone);
          if (user) {
            storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
          }
        }
      }
    }

    if (!ok) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }
    if (!user) {
      return res.status(401).json({ error: 'User not found for this OTP' });
    }

    if (user.tenantId) {
      try {
        const platform = await readPlatformStore();
        let store = platform.stores.find((s) => s.id === user.tenantId);
        if (!store && dbReady) {
          const dbStore = await Subscription.findOne({ id: user.tenantId }).lean();
          if (dbStore) {
            store = dbStore as any;
          }
        }
        if (!store) {
          return res.status(401).json({ error: "Your subscription has been deleted. Please contact support." });
        }
        if (store.status === "SUSPENDED") {
          return res.status(401).json({ error: "Your subscription is suspended. Please contact admin at 7558556969 to resume your subscription." });
        }
      } catch (err) {
        console.error("Failed to check store status during OTP verification", err);
      }
    }

    const isDummyAdminUser = email === dummyAdminEmail && user && !user.save;
    if (user.status === "BLOCKED") {
      return res.status(403).json({ error: "Your account has been blocked. Please contact administration." });
    }
    if (user.status === "INACTIVE") {
      return res.status(403).json({ error: "Your account is inactive. Please contact administration." });
    }
    
    user.lastLogin = new Date().toISOString();
    if (typeof user.save === 'function') {
      await user.save();
    } else if (!isDummyAdminUser) {
      await updateFallbackUser(user);
    }

    // create session token for verified user
    const reqIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '').toString();
    const device = req.headers['user-agent'] ? String(req.headers['user-agent']).substr(0, 200) : '';
    const session = await createSessionToken(user._id.toString(), user.email, user.role, user.branchId?.toString(), user.tenantId, reqIp, device, storeType);

    res.json({ success: true, message: 'OTP verified', data: { token: session.token, jti: session.jti, expiresAt: session.expiresAt, userId: user._id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId || null, storeType, passwordResetRequired: user.passwordResetRequired || false } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OTP verification failed' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ error: 'Provide email or phone' });
    if (email) {
      await otpService.sendOtpToEmail(email);
      return res.json({ success: true, message: 'OTP sent to email' });
    }
    await otpService.sendOtpToPhone(phone);
    return res.json({ success: true, message: 'OTP sent to phone' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to send OTP' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, phone, code, newPassword } = req.body;
    if (!newPassword || (!email && !phone) || !code) return res.status(400).json({ error: 'Provide email/phone, code and newPassword' });
    let ok = false;
    if (email) ok = otpService.verifyOtpForEmail(email, code);
    else ok = otpService.verifyOtpForPhone(phone!, code);
    if (!ok) return res.status(401).json({ error: 'Invalid or expired OTP' });
    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      user = email ? await User.findOne({ email } as any) : await User.findOne({ phone } as any);
      if (!user) {
        if (email) {
          try {
            const mUser = await ManufacturerUser.findOne({ email } as any);
            if (mUser) user = mUser;
          } catch (e) {}
          if (!user) {
            try {
              const rUser = await RetailerUser.findOne({ email } as any);
              if (rUser) user = rUser;
            } catch (e) {}
          }
          if (!user) {
            try {
              const saUser = await SuperAdminUser.findOne({ email } as any);
              if (saUser) user = saUser;
            } catch (e) {}
          }
        } else {
          try {
            const mUser = await ManufacturerUser.findOne({ phone } as any);
            if (mUser) user = mUser;
          } catch (e) {}
          if (!user) {
            try {
              const rUser = await RetailerUser.findOne({ phone } as any);
              if (rUser) user = rUser;
            } catch (e) {}
          }
          if (!user) {
            try {
              const saUser = await SuperAdminUser.findOne({ phone } as any);
              if (saUser) user = saUser;
            } catch (e) {}
          }
        }
      }
      if (!user) {
        user = email ? await findFallbackUserByEmail(email) : await findFallbackUserByPhone(phone!);
      }
    } else {
      user = email ? await findFallbackUserByEmail(email) : await findFallbackUserByPhone(phone!);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    const hashed = await bcrypt.hash(newPassword, 10);
    if (typeof user.save === 'function') {
      user.password = hashed;
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
      await user.save();
    } else {
      user.password = hashed;
      await updateFallbackUser(user);
    }
    return res.json({ success: true, message: 'Password updated' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Reset failed' });
  }
};

export const listSessions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'DB unavailable' });
    let u = await User.findOne({ _id: req.user.id } as any).select('sessions');
    if (!u) {
      try {
        const mUser = await ManufacturerUser.findOne({ _id: req.user.id } as any).select('sessions');
        if (mUser) u = mUser;
      } catch (e) {}
    }
    if (!u) {
      try {
        const rUser = await RetailerUser.findOne({ _id: req.user.id } as any).select('sessions');
        if (rUser) u = rUser;
      } catch (e) {}
    }
    if (!u) {
      try {
        const saUser = await SuperAdminUser.findOne({ _id: req.user.id } as any).select('sessions');
        if (saUser) u = saUser;
      } catch (e) {}
    }
    return res.json({ success: true, data: u ? u.sessions : [] });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to list sessions' });
  }
};

export const revokeSessionEndpoint = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { jti } = req.body;
    if (!jti) return res.status(400).json({ error: 'Provide jti' });
    const ok = await revokeSession(req.user.id, jti);
    return res.json({ success: ok });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Failed to revoke' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user.id === "admin-fallback") {
      return res.json({
        success: true,
        data: {
          _id: "admin-fallback",
          email: process.env.ADMIN_EMAIL || "manufacturer@aurajewel.com",
          name: "System Manufacturer",
          role: "ADMIN",
          branchId: null,
          phone: null
        }
      });
    }

    if (req.user.id === "retailer-fallback") {
      return res.json({
        success: true,
        data: {
          _id: "retailer-fallback",
          email: "retailer@aurajewel.com",
          name: "System Retailer",
          role: "RETAILER",
          branchId: null,
          phone: null,
          tenantId: "default-shop"
        }
      });
    }

    if (mongoose.connection.readyState !== 1) {
      const user = await findFallbackUserById(req.user.id);
      return res.json({ success: true, data: user });
    }

    let user = await User.findOne({ _id: req.user.id } as any).select("-password");
    if (!user) {
      try {
        const mUser = await ManufacturerUser.findOne({ _id: req.user.id } as any).select("-password");
        if (mUser) user = mUser;
      } catch (e) {}
    }
    if (!user) {
      try {
        const rUser = await RetailerUser.findOne({ _id: req.user.id } as any).select("-password");
        if (rUser) user = rUser;
      } catch (e) {}
    }
    if (!user) {
      try {
        const saUser = await SuperAdminUser.findOne({ _id: req.user.id } as any).select("-password");
        if (saUser) user = saUser;
      } catch (e) {}
    }
    if (!user) {
      user = await findFallbackUserById(req.user.id);
      if (user) {
        user = { ...user };
        delete user.password;
      }
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch profile" });
  }
};

export const getApiKey = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = generateApiKey(req.user.id, req.user.email, req.user.role, req.user.branchId, req.user.tenantId, req.user.storeType);
    return res.json({ success: true, data: { apiKey: token, expiresIn: process.env.API_KEY_EXPIRY || '30d' } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate API key" });
  }
};

export const oauthCallback = async (req: Request, res: Response) => {
  try {
    const { email, name, googleId } = req.body;

    let user = await User.findOne({ email } as any);

    if (!user) {
      user = new User({
        name,
        email,
        oauthProvider: "GOOGLE",
        oauthId: googleId,
        role: "CUSTOMER"
      });
      await user.save();
    }

    user.lastLogin = new Date();
    await user.save();

    const storeType = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "MANUFACTURER" : "RETAILER";
    const token = generateToken(user._id.toString(), user.email, user.role, user.branchId?.toString(), user.tenantId, storeType);

    res.json({
      success: true,
      message: "OAuth login successful",
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        storeType,
        token
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "OAuth authentication failed" });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const dbReady = mongoose.connection.readyState === 1;
    let user: any = null;
    if (dbReady) {
      user = await findAnyUserById(req.user.id);
    } else {
      user = await findFallbackUserById(req.user.id);
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }
      const isMatch = (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))
        ? await bcrypt.compare(currentPassword, user.password)
        : currentPassword === user.password;
      if (!isMatch) {
        return res.status(400).json({ error: "Incorrect current password" });
      }
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.passwordResetRequired = false;
    
    if (typeof user.save === 'function') {
      await user.save();
    } else {
      await updateFallbackUser(user);
    }

    user.sessions = user.sessions || [];
    const authHeader = (req.headers.authorization || '').toString();
    const token = authHeader.substring(7);
    let currentJti = '';
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      currentJti = payload.jti;
    } catch (e) {}
    
    if (currentJti) {
      user.sessions = user.sessions.filter((s: any) => s.jti === currentJti);
      if (typeof user.save === 'function') {
        await user.save();
      }
    }

    await logSecurityEvent(user.email, "password-changed", user._id?.toString() || user.id, `Password changed successfully`);

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to change password" });
  }
};


