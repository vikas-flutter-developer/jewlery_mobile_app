/**
 * storeSubService.ts
 * Business logic for store subscription lifecycle:
 * assign plan, suspend, reactivate, start trial, get payment history.
 *
 * On each state change this service:
 *   1. Updates StoreSubscription
 *   2. Creates a PaymentHistory record (where applicable)
 *   3. Syncs the change to the legacy SuperAdminSubscription (Subscription model)
 *   4. Writes an audit log
 */
import mongoose from "mongoose";
import { planRepository } from "../repositories/planRepository.js";
import { storeSubRepository } from "../repositories/storeSubRepository.js";
import { paymentRepository } from "../repositories/paymentRepository.js";
import { SuperAdminSubscription } from "../../models/index.js";
import { auditLog } from "./planService.js";

// ── Helper: sync status change to the legacy Subscription model ───────────────

const syncLegacySubscription = async (
  storeId: string,
  status: string,
  endDate: Date,
  planSlug: string,
  paymentStatus: string
) => {
  try {
    const existing = await SuperAdminSubscription.findOne({ id: storeId });
    if (existing) {
      existing.status = status;
      existing.subscriptionExpiry = endDate.toISOString();
      existing.planName = planSlug.toUpperCase();
      existing.paymentStatus = paymentStatus;
      existing.updatedAt = new Date().toISOString();
      await existing.save();
    }
  } catch (err) {
    console.error("[StoreSubService] Failed to sync to legacy Subscription:", err);
  }
};

// ── Service ───────────────────────────────────────────────────────────────────

export const storeSubService = {
  /**
   * Assign (or re-assign) a plan to a store.
   * Creates a new StoreSubscription and a SUCCESS PaymentHistory record.
   */
  async assignPlan(
    storeId: string,
    planId: string,
    opts: {
      amount?: number;
      method?: string;
      referenceId?: string;
      gateway?: string;
      notes?: string;
      invoiceId?: string;
      invoiceNumber?: string;
    },
    actor: string,
    ip?: string
  ) {
    // 1. Load the plan
    const plan = await planRepository.findById(planId);
    if (!plan) throw { statusCode: 404, message: "Subscription plan not found" };
    if (!plan.isActive) throw { statusCode: 400, message: "Cannot assign an inactive plan" };

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    // 2. Cancel the current active subscription for this store (if any)
    const currentSub = await storeSubRepository.findByStoreId(storeId);
    if (currentSub && ["ACTIVE", "TRIAL", "PENDING"].includes(currentSub.status)) {
      await storeSubRepository.update(String(currentSub._id), {
        status: "CANCELLED",
        cancelledAt: now,
        notes: `Replaced by new plan "${plan.name}" assigned by ${actor}`,
      });
    }

    // 3. Create new StoreSubscription
    const sub = await storeSubRepository.create({
      storeId,
      planId: plan._id,
      planSlug: plan.slug,
      planName: plan.name,
      status: "ACTIVE",
      startDate: now,
      endDate,
      autoRenew: false,
      assignedBy: actor,
      notes: opts.notes || `Plan assigned by ${actor}`,
    });

    // 4. Record payment
    const payment = await paymentRepository.create({
      storeId,
      planId: plan._id,
      planSlug: plan.slug,
      planName: plan.name,
      subscriptionId: sub._id,
      amount: opts.amount ?? plan.price,
      currency: "INR",
      method: opts.method || "CASH",
      status: "SUCCESS",
      referenceId: opts.referenceId || "",
      gateway: opts.gateway || "MANUAL",
      invoiceId: opts.invoiceId || "",
      invoiceNumber: opts.invoiceNumber || "",
      paidAt: now,
      notes: opts.notes || `Payment for plan "${plan.name}"`,
      recordedBy: actor,
    });

    // 5. Sync to legacy model
    await syncLegacySubscription(storeId, "ACTIVE", endDate, plan.slug, "PAID");

    // 6. Audit
    await auditLog(
      actor,
      "store.assign_plan",
      "store_subscription",
      storeId,
      `Assigned plan "${plan.name}" to store ${storeId}. Expires: ${endDate.toISOString()}`,
      ip
    );

    return { subscription: sub, payment };
  },

  /**
   * Suspend a store — sets status to SUSPENDED and blocks API access via middleware.
   */
  async suspendStore(storeId: string, reason: string, actor: string, ip?: string) {
    const sub = await storeSubRepository.findByStoreId(storeId);
    if (!sub) throw { statusCode: 404, message: "No subscription found for this store" };
    if (sub.status === "SUSPENDED") throw { statusCode: 400, message: "Store is already suspended" };

    const now = new Date();
    const updated = await storeSubRepository.update(String(sub._id), {
      status: "SUSPENDED",
      suspendedAt: now,
      suspendReason: reason || "Suspended by super admin",
    });

    await syncLegacySubscription(storeId, "SUSPENDED", new Date(sub.endDate as any), sub.planSlug, "FAILED");

    await auditLog(
      actor,
      "store.suspend",
      "store_subscription",
      storeId,
      `Suspended store ${storeId}. Reason: ${reason}`,
      ip
    );

    return updated;
  },

  /**
   * Reactivate a suspended or expired store — restores ACTIVE status.
   * Extends endDate by the original plan duration if already expired.
   */
  async reactivateStore(storeId: string, actor: string, ip?: string) {
    const sub = await storeSubRepository.findByStoreId(storeId);
    if (!sub) throw { statusCode: 404, message: "No subscription found for this store" };
    if (sub.status === "ACTIVE") throw { statusCode: 400, message: "Store is already active" };

    const now = new Date();
    let endDate = new Date(sub.endDate as any);

    // If already expired, extend from today
    if (endDate < now) {
      const plan = await planRepository.findById(String(sub.planId));
      const months = plan ? plan.durationMonths : 1;
      endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + months);
    }

    const updated = await storeSubRepository.update(String(sub._id), {
      status: "ACTIVE",
      reactivatedAt: now,
      suspendedAt: null,
      suspendReason: "",
      endDate,
    });

    await syncLegacySubscription(storeId, "ACTIVE", endDate, sub.planSlug, "PAID");

    await auditLog(
      actor,
      "store.reactivate",
      "store_subscription",
      storeId,
      `Reactivated store ${storeId}. New expiry: ${endDate.toISOString()}`,
      ip
    );

    return updated;
  },

  /**
   * Start a trial for a store on a given plan.
   * Creates a TRIAL StoreSubscription with a short endDate (trialDays).
   */
  async startTrial(
    storeId: string,
    planId: string,
    trialDays: number,
    actor: string,
    ip?: string
  ) {
    const plan = await planRepository.findById(planId);
    if (!plan) throw { statusCode: 404, message: "Subscription plan not found" };

    const days = trialDays > 0 ? trialDays : plan.trialDays > 0 ? plan.trialDays : 14;
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Cancel existing active/trial sub
    const existing = await storeSubRepository.findByStoreId(storeId);
    if (existing && ["ACTIVE", "TRIAL", "PENDING"].includes(existing.status)) {
      throw {
        statusCode: 400,
        message: `Store already has an ${existing.status} subscription. Suspend or cancel it first.`,
      };
    }

    const sub = await storeSubRepository.create({
      storeId,
      planId: plan._id,
      planSlug: plan.slug,
      planName: plan.name,
      status: "TRIAL",
      startDate: now,
      endDate: trialEndsAt,
      trialEndsAt,
      assignedBy: actor,
      notes: `${days}-day trial started by ${actor}`,
    });

    await syncLegacySubscription(storeId, "TRIAL", trialEndsAt, plan.slug, "DUE");

    await auditLog(
      actor,
      "store.start_trial",
      "store_subscription",
      storeId,
      `Started ${days}-day trial on plan "${plan.name}" for store ${storeId}`,
      ip
    );

    return sub;
  },

  /**
   * Get paginated payment history for a store.
   */
  async getPaymentHistory(storeId: string, page: number, limit: number) {
    return paymentRepository.findByStoreId(storeId, page, limit);
  },

  /**
   * Get the current subscription for a store.
   */
  async getSubscription(storeId: string) {
    return storeSubRepository.findByStoreId(storeId);
  },
};
