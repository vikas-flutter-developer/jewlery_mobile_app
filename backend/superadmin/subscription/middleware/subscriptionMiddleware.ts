/**
 * subscriptionMiddleware.ts
 *
 * Three drop-in Express middleware functions for protecting routes:
 *
 *  1. requireActiveSubscription  — blocks SUSPENDED / EXPIRED / CANCELLED stores
 *  2. requireNonExpiredPlan      — blocks stores whose endDate has passed
 *  3. requireFeatureAccess(key)  — blocks access when a feature flag is disabled
 *
 * Usage:
 *   import { requireActiveSubscription, requireFeatureAccess } from '.../subscriptionMiddleware.js';
 *   router.get('/old-gold', authMiddleware, requireActiveSubscription, requireFeatureAccess('enableOldGold'), handler);
 */
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { storeSubRepository } from "../repositories/storeSubRepository.js";
import { featureFlagService } from "../services/featureFlagService.js";
import { ApiResponse } from "../../lib/apiResponse.js";

// ── 1. Require Active Subscription ───────────────────────────────────────────

/**
 * Middleware: ensures the requesting store has an ACTIVE or TRIAL subscription.
 *
 * Requires `req.user.tenantId` (set by authMiddleware).
 * Skips check for SUPER_ADMIN users (they bypass all restrictions).
 */
export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin always bypasses
    if (req.user?.role === "SUPER_ADMIN") {
      next();
      return;
    }

    const storeId = req.user?.tenantId;
    if (!storeId) {
      ApiResponse.unauthorized(res, "No store identity found in token");
      return;
    }

    const sub = await storeSubRepository.findByStoreId(storeId);

    if (!sub) {
      // No subscription record — allow access (legacy stores without a new sub record)
      next();
      return;
    }

    switch (sub.status) {
      case "ACTIVE":
      case "TRIAL":
        next();
        return;

      case "SUSPENDED":
        ApiResponse.forbidden(
          res,
          `Your store subscription is suspended. Reason: ${(sub as any).suspendReason || "Contact admin"}. Please contact support.`
        );
        return;

      case "EXPIRED":
        ApiResponse.forbidden(
          res,
          "Your subscription has expired. Please renew to continue using the platform."
        );
        return;

      case "CANCELLED":
        ApiResponse.forbidden(
          res,
          "Your subscription has been cancelled. Please contact admin to reactivate."
        );
        return;

      case "PENDING":
        ApiResponse.forbidden(
          res,
          "Your subscription is pending activation. Please contact admin."
        );
        return;

      default:
        ApiResponse.forbidden(res, "Subscription status invalid. Please contact admin.");
        return;
    }
  } catch (err) {
    console.error("[requireActiveSubscription] Error:", err);
    // On error, allow through (fail-open) to avoid locking out stores on DB issues
    next();
  }
};

// ── 2. Require Non-Expired Plan ───────────────────────────────────────────────

/**
 * Middleware: checks that the store's subscription endDate has not passed.
 * If endDate has passed, auto-marks the subscription as EXPIRED and blocks.
 *
 * Should be used after requireActiveSubscription.
 */
export const requireNonExpiredPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role === "SUPER_ADMIN") {
      next();
      return;
    }

    const storeId = req.user?.tenantId;
    if (!storeId) {
      next();
      return;
    }

    const sub = await storeSubRepository.findByStoreId(storeId);
    if (!sub) {
      next();
      return;
    }

    const endDate = new Date(sub.endDate as any);
    if (endDate < new Date()) {
      // Auto-expire the subscription
      try {
        await storeSubRepository.update(String(sub._id), { status: "EXPIRED" });
      } catch (updateErr) {
        console.error("[requireNonExpiredPlan] Failed to auto-expire sub:", updateErr);
      }

      ApiResponse.forbidden(
        res,
        `Your plan expired on ${endDate.toLocaleDateString("en-IN")}. Please contact admin to renew.`
      );
      return;
    }

    next();
  } catch (err) {
    console.error("[requireNonExpiredPlan] Error:", err);
    next(); // fail-open
  }
};

// ── 3. Require Feature Access ─────────────────────────────────────────────────

/**
 * Middleware factory: checks that a named feature flag is enabled
 * for the requesting store's context (store → plan → global resolution).
 *
 * @param flagKey  The feature flag key (e.g. "enableOldGold")
 *
 * Example:
 *   router.get('/old-gold', authMiddleware, requireFeatureAccess('enableOldGold'), handler);
 */
export const requireFeatureAccess = (flagKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Super admin always has access
      if (req.user?.role === "SUPER_ADMIN") {
        next();
        return;
      }

      const storeId = req.user?.tenantId || undefined;

      const enabled = await featureFlagService.isFlagEnabled(flagKey, { storeId });

      if (!enabled) {
        ApiResponse.forbidden(
          res,
          `The feature "${flagKey}" is not available on your current plan. Please contact admin to upgrade.`
        );
        return;
      }

      next();
    } catch (err) {
      console.error(`[requireFeatureAccess:${flagKey}] Error:`, err);
      next(); // fail-open on error
    }
  };
};
