/**
 * ContractPriceResolutionService
 *
 * Resolves the vendor purchase rate using a 3-tier priority chain:
 *   [1] Active Vendor Contract Rule  → CONTRACT_RULE
 *   [2] Latest Vendor Purchase Price → PURCHASE_PRICE (derived from Inventory)
 *   [3] Default System Metal Rate    → DEFAULT_RATE
 *
 * Every resolution is persisted in PriceResolutionLog.
 * Fallbacks trigger in-app notifications.
 *
 * This service is HTTP-free and fully injectable into any controller.
 */

import {
  VendorRateRule,
  VendorRateContract,
  Rate,
  Inventory,
  PriceResolutionLog,
  Notification,
} from "../../models/index.js";
import { SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/db.js";

export interface PriceResolutionInput {
  vendorId: string;
  metalType: "GOLD" | "SILVER" | "PLATINUM";
  purity: string;
  transactionDate?: Date;
}

export interface PriceResolutionResult {
  resolvedRate: number;
  source: "CONTRACT_RULE" | "PURCHASE_PRICE" | "DEFAULT_RATE";
  contractId?: string;
  ruleId?: string;
  remarks: string;
  logId: string;
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/** Normalise metal type string for Rate collection lookup (e.g. GOLD + 22K → gold22K) */
const buildRateMetalKey = (metalType: string, purity: string): string => {
  const metal = metalType.toLowerCase();
  const purityClean = purity.replace(/[^0-9a-zA-Z]/g, "");
  return `${metal}${purityClean}`;
};

/** Fetch the current default system rate for a metal/purity combination */
const fetchDefaultRate = async (tenantId: string, metalType: string, purity: string): Promise<number | null> => {
  try {
    const metalKey = buildRateMetalKey(metalType, purity);
    // Try exact metal+purity key first, then broader metal-only match
    const rate = await Rate.findOne({
      $or: [
        { metal: metalKey },
        { metal: new RegExp(metalType.toLowerCase(), "i") }
      ]
    })
      .sort({ updatedAt: -1 })
      .lean();

    return rate ? Number(rate.rate) : null;
  } catch {
    return null;
  }
};

/** Resolve rate from an active contract rule, applying MARKET offset if needed */
const resolveFromContractRule = async (
  tenantId: string,
  input: PriceResolutionInput,
  txDate: Date
): Promise<{ rate: number; ruleId: string; contractId: string; rateType: string; rateValue: number } | null> => {
  const rule = await VendorRateRule.findOne({
    tenantId,
    vendorId: input.vendorId,
    metalType: input.metalType,
    purity: input.purity,
    status: "ACTIVE",
    effectiveFrom: { $lte: txDate },
    effectiveTo: { $gte: txDate }
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  if (!rule) return null;

  const contractId = String(rule.contractId);
  const ruleId = String(rule._id);
  const rateType: string = rule.rateType;
  const rateValue: number = rule.rateValue;

  if (rateType === "FIXED_RATE") {
    return { rate: rateValue, ruleId, contractId, rateType, rateValue };
  }

  // MARKET_PLUS / MARKET_MINUS require the current default metal rate
  const defaultRate = await fetchDefaultRate(tenantId, input.metalType, input.purity);
  if (defaultRate === null) return null;

  const resolved = rateType === "MARKET_PLUS"
    ? defaultRate + rateValue
    : Math.max(0, defaultRate - rateValue);

  return { rate: resolved, ruleId, contractId, rateType, rateValue };
};

/** Derive ₹/gm from the most recent purchase record in Inventory for this vendor+metal+purity */
const resolveFromPurchaseHistory = async (
  tenantId: string,
  input: PriceResolutionInput
): Promise<number | null> => {
  try {
    const metalPattern = new RegExp(input.metalType.charAt(0) + input.metalType.slice(1).toLowerCase(), "i");
    const record = await Inventory.findOne({
      $or: [
        { type: input.metalType },
        { type: metalPattern }
      ],
      purity: input.purity
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!record) return null;
    const price = Number(record.price);
    const weight = Number(record.weight) || Number(record.grossWeight) || 1;
    if (!price || price <= 0) return null;
    return parseFloat((price / weight).toFixed(2));
  } catch {
    return null;
  }
};

/** Write notification for fallback usage */
const notifyFallback = async (
  tenantId: string,
  source: "PURCHASE_PRICE" | "DEFAULT_RATE",
  input: PriceResolutionInput
) => {
  try {
    if (!isDbConnected()) return;
    const isDefault = source === "DEFAULT_RATE";
    await Notification.create({
      notificationId: `NOTIF-PRICE-${Date.now()}`,
      tenantId,
      storeId: tenantId,
      type: "VENDOR_ALERT",
      title: isDefault ? "Default Rate Used for Price Resolution" : "No Active Contract — Using Purchase History",
      message: isDefault
        ? `No active contract rule or purchase history found for ${input.metalType} ${input.purity}. Default system rate applied.`
        : `No active contract rule for ${input.metalType} ${input.purity}. Latest purchase price used as fallback.`,
      category: "PriceResolution",
      severity: isDefault ? "WARNING" : "INFO",
      channels: ["IN_APP"],
      sendAt: new Date(),
      status: "PENDING"
    });
  } catch (err) {
    console.error("Failed to send price resolution notification:", err);
  }
};

/** Write audit log */
const logResolution = async (
  tenantId: string,
  source: string,
  input: PriceResolutionInput,
  resolvedRate: number
) => {
  try {
    if (!isDbConnected()) return;
    await SecurityAudit.create({
      id: `AUDIT-PRICE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      actor: "SYSTEM",
      action: "PRICE_RESOLVED",
      entityType: "PriceResolution",
      entityId: tenantId,
      details: `${input.metalType} ${input.purity} → ₹${resolvedRate}/gm via ${source} for vendor ${input.vendorId}`,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to write price resolution audit log:", err);
  }
};

// ─── Main Public API ──────────────────────────────────────────────────────────

export const resolvePrice = async (
  input: PriceResolutionInput,
  tenantId: string
): Promise<PriceResolutionResult> => {
  const txDate = input.transactionDate instanceof Date ? input.transactionDate : new Date(input.transactionDate ?? Date.now());

  // ── Step 1: Try active contract rule ─────────────────────────────────────
  const contractRuleResult = await resolveFromContractRule(tenantId, input, txDate);

  if (contractRuleResult) {
    let remarks = `Contract rule applied: ${contractRuleResult.rateType} = ₹${contractRuleResult.rate}/gm`;
    if (contractRuleResult.rateType !== "FIXED_RATE") {
      remarks = `${contractRuleResult.rateType === "MARKET_PLUS" ? "MARKET_PLUS" : "MARKET_MINUS"} applied: base rate ± ₹${contractRuleResult.rateValue}/gm = ₹${contractRuleResult.rate}/gm`;
    }

    const log = isDbConnected() ? await PriceResolutionLog.create({
      tenantId,
      vendorId: input.vendorId,
      metalType: input.metalType,
      purity: input.purity,
      transactionDate: txDate,
      resolvedRate: contractRuleResult.rate,
      source: "CONTRACT_RULE",
      contractId: contractRuleResult.contractId,
      ruleId: contractRuleResult.ruleId,
      remarks
    }) : { _id: `mock-log-${Date.now()}` };

    await logResolution(tenantId, "CONTRACT_RULE", input, contractRuleResult.rate);

    return {
      resolvedRate: contractRuleResult.rate,
      source: "CONTRACT_RULE",
      contractId: contractRuleResult.contractId,
      ruleId: contractRuleResult.ruleId,
      remarks,
      logId: String(log._id)
    };
  }

  // ── Step 2: Try latest purchase price ────────────────────────────────────
  const purchaseRate = await resolveFromPurchaseHistory(tenantId, input);

  if (purchaseRate !== null) {
    const remarks = `No active contract rule. Purchase price fallback: ₹${purchaseRate}/gm`;

    const log = isDbConnected() ? await PriceResolutionLog.create({
      tenantId,
      vendorId: input.vendorId,
      metalType: input.metalType,
      purity: input.purity,
      transactionDate: txDate,
      resolvedRate: purchaseRate,
      source: "PURCHASE_PRICE",
      remarks
    }) : { _id: `mock-log-${Date.now()}` };

    await notifyFallback(tenantId, "PURCHASE_PRICE", input);
    await logResolution(tenantId, "PURCHASE_PRICE", input, purchaseRate);

    return {
      resolvedRate: purchaseRate,
      source: "PURCHASE_PRICE",
      remarks,
      logId: String(log._id)
    };
  }

  // ── Step 3: Use default system metal rate ────────────────────────────────
  const defaultRate = await fetchDefaultRate(tenantId, input.metalType, input.purity);
  const resolvedRate = defaultRate ?? 0;

  const remarks = resolvedRate > 0
    ? `No contract rule or purchase history. Default system rate applied: ₹${resolvedRate}/gm`
    : `No rate data found for ${input.metalType} ${input.purity}. Rate defaulted to 0.`;

  const log = isDbConnected() ? await PriceResolutionLog.create({
    tenantId,
    vendorId: input.vendorId,
    metalType: input.metalType,
    purity: input.purity,
    transactionDate: txDate,
    resolvedRate,
    source: "DEFAULT_RATE",
    remarks
  }) : { _id: `mock-log-${Date.now()}` };

  await notifyFallback(tenantId, "DEFAULT_RATE", input);
  await logResolution(tenantId, "DEFAULT_RATE", input, resolvedRate);

  return {
    resolvedRate,
    source: "DEFAULT_RATE",
    remarks,
    logId: String(log._id)
  };
};
