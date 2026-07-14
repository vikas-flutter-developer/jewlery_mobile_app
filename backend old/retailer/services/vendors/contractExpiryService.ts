/**
 * ContractExpiryService
 *
 * Owns ALL contract expiry alert logic:
 *   - Alert generation at 30 / 15 / 7 / 1 day thresholds
 *   - Deduplication via keyed notificationId (never fires duplicate alerts)
 *   - Auto-expiry transition (ACTIVE → EXPIRED) for past-due contracts
 *   - Audit log entry per alert generated
 *   - Returns summary counts for dashboard use
 *
 * Pure service — no HTTP coupling. Injectable into controllers and scheduler.
 */

import {
  VendorRateContract,
  Notification,
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

// Alert thresholds in ascending priority order
const ALERT_THRESHOLDS = [30, 15, 7, 1] as const;
type AlertThreshold = typeof ALERT_THRESHOLDS[number];

export interface ExpiryAlertResult {
  alertsGenerated: number;
  contractsExpired: number;
  contractsExpiringSoon: number;
}

export interface ExpiringContract {
  _id: string;
  contractNumber: string;
  vendorId: any;
  metalType: string;
  effectiveFrom: Date;
  effectiveTo: Date;
  status: string;
  remarks: string;
  daysRemaining: number;
  alertLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface ExpirySummary {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  expiring30Days: number;
  expiring15Days: number;
  expiring7Days: number;
  expiring1Day: number;
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

const computeDaysRemaining = (effectiveTo: Date): number =>
  Math.ceil((new Date(effectiveTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

const resolveAlertLevel = (daysRemaining: number): ExpiringContract["alertLevel"] => {
  if (daysRemaining <= 1) return "CRITICAL";
  if (daysRemaining <= 7) return "HIGH";
  if (daysRemaining <= 15) return "MEDIUM";
  return "LOW";
};

const resolveAlertSeverity = (threshold: AlertThreshold): "CRITICAL" | "WARNING" => {
  return threshold <= 7 ? "CRITICAL" : "WARNING";
};

/** Write a dedup-safe in-app notification for a contract expiry threshold. */
const createExpiryAlert = async (
  tenantId: string,
  contract: any,
  daysRemaining: number,
  threshold: AlertThreshold
): Promise<boolean> => {
  const notificationId = `CONTRACT_EXPIRY_${contract._id}_${threshold}D`;
  try {
    const existing = await Notification.findOne({ notificationId });
    if (existing) return false; // already sent

    await Notification.create({
      notificationId,
      tenantId,
      storeId: tenantId,
      type: "VENDOR_ALERT",
      title: daysRemaining <= 1
        ? `Contract Expiring TODAY: ${contract.contractNumber}`
        : `Contract Expiring in ${daysRemaining} Days: ${contract.contractNumber}`,
      message: `Vendor contract ${contract.contractNumber} for ${contract.metalType} expires on ${new Date(contract.effectiveTo).toLocaleDateString()}. ${daysRemaining <= 1 ? "Immediate renewal required." : `${daysRemaining} days remaining.`}`,
      category: "VendorContracts",
      severity: resolveAlertSeverity(threshold),
      channels: ["IN_APP"],
      sendAt: new Date(),
      status: "PENDING",
    });
    return true;
  } catch (err) {
    console.error(`[ContractExpiryService] Failed to create alert ${notificationId}:`, err);
    return false;
  }
};

/** Write audit log for an expiry event. */
const logExpiryAudit = async (
  tenantId: string,
  action: string,
  details: string
): Promise<void> => {
  try {
    if (!isDbConnected()) return;
    await SecurityAudit.create({
      id: `AUDIT-EXPIRY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      actor: "SYSTEM",
      action,
      entityType: "VendorRateContract",
      entityId: tenantId,
      details,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ContractExpiryService] Failed to write audit log:", err);
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Core scheduled/manual check:
 * 1. Auto-expires contracts past their effectiveTo date.
 * 2. Generates threshold alerts (30/15/7/1 day) for contracts expiring soon.
 * 3. Deduplicates every alert by notificationId — safe to call repeatedly.
 */
export const checkAndAlertExpiring = async (tenantId: string): Promise<ExpiryAlertResult> => {
  if (!isDbConnected()) {
    return { alertsGenerated: 0, contractsExpired: 0, contractsExpiringSoon: 0 };
  }

  const now = new Date();
  let alertsGenerated = 0;

  // ── Step 1: Auto-expire past-due ACTIVE contracts ────────────────────────
  const pastDueContracts = await VendorRateContract.find({
    tenantId,
    status: "ACTIVE",
    effectiveTo: { $lt: now },
  });

  for (const contract of pastDueContracts) {
    contract.status = "EXPIRED";
    await contract.save();

    await logExpiryAudit(
      tenantId,
      "CONTRACT_EXPIRED",
      `Contract ${contract.contractNumber} auto-expired (effectiveTo: ${new Date(contract.effectiveTo).toISOString()})`
    );

    // Dedup-safe expiry notification
    const notificationId = `CONTRACT_EXPIRED_${contract._id}`;
    const existing = await Notification.findOne({ notificationId });
    if (!existing) {
      await Notification.create({
        notificationId,
        tenantId,
        storeId: tenantId,
        type: "VENDOR_ALERT",
        title: `Vendor Contract Expired: ${contract.contractNumber}`,
        message: `Contract ${contract.contractNumber} for ${contract.metalType} has expired as of ${new Date(contract.effectiveTo).toLocaleDateString()}. Please renew immediately.`,
        category: "VendorContracts",
        severity: "CRITICAL",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
      alertsGenerated++;
    }
  }

  // ── Step 2: Generate threshold alerts for ACTIVE contracts ───────────────
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringContracts = await VendorRateContract.find({
    tenantId,
    status: "ACTIVE",
    effectiveTo: { $gte: now, $lte: windowEnd },
  }).lean();

  for (const contract of expiringContracts) {
    const daysRemaining = computeDaysRemaining(contract.effectiveTo);

    for (const threshold of ALERT_THRESHOLDS) {
      if (daysRemaining <= threshold) {
        const sent = await createExpiryAlert(tenantId, contract, daysRemaining, threshold);
        if (sent) {
          alertsGenerated++;
          await logExpiryAudit(
            tenantId,
            "EXPIRY_ALERT_GENERATED",
            `Alert sent: Contract ${contract.contractNumber} expires in ${daysRemaining} days (threshold: ${threshold}D)`
          );
        }
      }
    }
  }

  return {
    alertsGenerated,
    contractsExpired: pastDueContracts.length,
    contractsExpiringSoon: expiringContracts.length,
  };
};

/**
 * Returns paginated list of active contracts expiring within `daysWindow` days,
 * annotated with daysRemaining and alertLevel.
 */
export const getExpiringContracts = async (
  tenantId: string,
  daysWindow = 30,
  vendorId?: string,
  metalType?: string,
  page = 1,
  limit = 10
): Promise<{ data: ExpiringContract[]; total: number }> => {
  if (!isDbConnected()) return { data: [], total: 0 };

  const now = new Date();
  const windowEnd = new Date(now.getTime() + daysWindow * 24 * 60 * 60 * 1000);

  const query: any = {
    tenantId,
    status: "ACTIVE",
    effectiveTo: { $gte: now, $lte: windowEnd },
  };
  if (vendorId) query.vendorId = vendorId;
  if (metalType) query.metalType = metalType;

  const total = await VendorRateContract.countDocuments(query);
  const raw = await VendorRateContract.find(query)
    .populate("vendorId", "name code mobile")
    .sort({ effectiveTo: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const data: ExpiringContract[] = raw.map((c: any) => ({
    _id: String(c._id),
    contractNumber: c.contractNumber,
    vendorId: c.vendorId,
    metalType: c.metalType,
    effectiveFrom: c.effectiveFrom,
    effectiveTo: c.effectiveTo,
    status: c.status,
    remarks: c.remarks || "",
    daysRemaining: computeDaysRemaining(c.effectiveTo),
    alertLevel: resolveAlertLevel(computeDaysRemaining(c.effectiveTo)),
  }));

  return { data, total };
};

/**
 * Returns breakdown counts for the expiry dashboard summary.
 */
export const getExpirySummary = async (tenantId: string): Promise<ExpirySummary> => {
  if (!isDbConnected()) {
    return { total: 0, active: 0, expired: 0, expiringSoon: 0, expiring30Days: 0, expiring15Days: 0, expiring7Days: 0, expiring1Day: 0 };
  }

  const now = new Date();

  const buildWindowEnd = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const [total, active, expired, e30, e15, e7, e1] = await Promise.all([
    VendorRateContract.countDocuments({ tenantId }),
    VendorRateContract.countDocuments({ tenantId, status: "ACTIVE" }),
    VendorRateContract.countDocuments({ tenantId, status: "EXPIRED" }),
    VendorRateContract.countDocuments({ tenantId, status: "ACTIVE", effectiveTo: { $gte: now, $lte: buildWindowEnd(30) } }),
    VendorRateContract.countDocuments({ tenantId, status: "ACTIVE", effectiveTo: { $gte: now, $lte: buildWindowEnd(15) } }),
    VendorRateContract.countDocuments({ tenantId, status: "ACTIVE", effectiveTo: { $gte: now, $lte: buildWindowEnd(7) } }),
    VendorRateContract.countDocuments({ tenantId, status: "ACTIVE", effectiveTo: { $gte: now, $lte: buildWindowEnd(1) } }),
  ]);

  return {
    total,
    active,
    expired,
    expiringSoon: e30,
    expiring30Days: e30,
    expiring15Days: e15,
    expiring7Days: e7,
    expiring1Day: e1,
  };
};
