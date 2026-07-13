import { readSettings } from "./settingsStore.js";
import { isDbConnected } from "./serverState.js";
import { MakingChargeRule } from "../retailer/models/index.js";

export type OrderSample = {
  subtotal: number;
  state?: string;
  items?: any[];
  meta?: Record<string, any>;
};

export type MakingChargeParams = {
  metalType: "GOLD" | "SILVER" | "PLATINUM" | "DIAMOND" | "GEMSTONE" | "ALL" | string;
  category?: string;
  subCategory?: string;
  purity?: string;
  weight?: number;
  quantity?: number;
  productValue?: number;
  productId?: string;
  customerId?: string;
  branchId?: string;
};

/**
 * Resolves the final making charge based on the priority:
 * PRODUCT -> CUSTOMER -> CATEGORY -> BRANCH -> GLOBAL -> FALLBACK SETTING
 */
export const resolveMakingCharge = async (params: MakingChargeParams): Promise<{
  appliedRule: any | null;
  calculationMethod: "PER_GRAM" | "FIXED" | "PERCENTAGE" | "PER_PIECE" | string;
  chargeAmount: number;
  fallback: boolean;
}> => {
  const metalType = (params.metalType || "GOLD").toUpperCase();
  const category = (params.category || "").trim();
  const subCategory = (params.subCategory || "").trim();
  const purity = (params.purity || "").trim();
  const weight = Number(params.weight || 0);
  const quantity = Number(params.quantity || 1);
  const productValue = Number(params.productValue || 0);
  const productId = (params.productId || "").trim();
  const customerId = (params.customerId || "").trim();
  const branchId = (params.branchId || "").trim();

  let matchedRule: any = null;

  if (isDbConnected()) {
    // Fetch all active rules that match metalType or ALL
    const activeRules = await MakingChargeRule.find({
      isActive: true,
      metalType: { $in: [metalType, "ALL"] },
      $and: [
        {
          $or: [
            { effectiveFrom: null },
            { effectiveFrom: { $lte: new Date() } }
          ]
        },
        {
          $or: [
            { effectiveTo: null },
            { effectiveTo: { $gte: new Date() } }
          ]
        }
      ]
    }).lean();

    // Sort by priority rules: PRODUCT > CUSTOMER > CATEGORY > BRANCH > GLOBAL
    const getTypeValue = (type: string) => {
      switch (type) {
        case "PRODUCT": return 1;
        case "CUSTOMER": return 2;
        case "CATEGORY": return 3;
        case "BRANCH": return 4;
        case "GLOBAL": return 5;
        default: return 6;
      }
    };

    const sortedRules = activeRules.sort((a, b) => {
      const typeDiff = getTypeValue(a.ruleType) - getTypeValue(b.ruleType);
      if (typeDiff !== 0) return typeDiff;
      return (a.priority || 100) - (b.priority || 100);
    });

    for (const rule of sortedRules) {
      // 1. PRODUCT Match
      if (rule.ruleType === "PRODUCT") {
        if (productId && rule.productId === productId) {
          matchedRule = rule;
          break;
        }
        continue;
      }

      // 2. CUSTOMER Match
      if (rule.ruleType === "CUSTOMER") {
        if (customerId && rule.customerId === customerId) {
          matchedRule = rule;
          break;
        }
        continue;
      }

      // 3. CATEGORY Match
      if (rule.ruleType === "CATEGORY") {
        const catMatch = !rule.category || rule.category.toLowerCase() === category.toLowerCase();
        const subCatMatch = !rule.subCategory || rule.subCategory.toLowerCase() === subCategory.toLowerCase();
        const purityMatch = !rule.purity || rule.purity.toLowerCase() === purity.toLowerCase();
        if (catMatch && subCatMatch && purityMatch) {
          matchedRule = rule;
          break;
        }
        continue;
      }

      // 4. BRANCH Match
      if (rule.ruleType === "BRANCH") {
        if (branchId && rule.branchId === branchId) {
          matchedRule = rule;
          break;
        }
        continue;
      }

      // 5. GLOBAL Match
      if (rule.ruleType === "GLOBAL") {
        matchedRule = rule;
        break;
      }
    }
  }

  if (matchedRule) {
    let chargeAmount = 0;
    const value = Number(matchedRule.value || 0);

    if (matchedRule.calculationMethod === "PER_GRAM") {
      chargeAmount = weight * value;
    } else if (matchedRule.calculationMethod === "FIXED") {
      chargeAmount = value;
    } else if (matchedRule.calculationMethod === "PERCENTAGE") {
      chargeAmount = productValue * (value / 100);
    } else if (matchedRule.calculationMethod === "PER_PIECE") {
      chargeAmount = quantity * value;
    }

    // Apply min/max boundary constraints
    if (matchedRule.minValue != null && chargeAmount < matchedRule.minValue) {
      chargeAmount = matchedRule.minValue;
    }
    if (matchedRule.maxValue != null && chargeAmount > matchedRule.maxValue) {
      chargeAmount = matchedRule.maxValue;
    }

    return {
      appliedRule: matchedRule,
      calculationMethod: matchedRule.calculationMethod,
      chargeAmount: Math.round(chargeAmount),
      fallback: false,
    };
  }

  // Fallback default calculation from Store Settings
  const store = await readSettings();
  const fallbackPercent = Number(store.settings?.defaultMakingChargePercent) || 10;
  const chargeAmount = productValue * (fallbackPercent / 100);

  return {
    appliedRule: null,
    calculationMethod: "PERCENTAGE",
    chargeAmount: Math.round(chargeAmount),
    fallback: true,
  };
};

export const evaluateChargeRules = async (order: OrderSample) => {
  const store = await readSettings();
  const rules = (store.settings.chargeRules || []) as any[];
  const taxProfiles = (store.settings.taxProfiles || {}) as Record<string, any>;

  let charges: any[] = [];
  let totalCharge = 0;

  const state = order.state || '';
  for (const r of rules.sort((a,b) => (a.priority||0) - (b.priority||0))) {
    const minOk = r.minAmount == null || order.subtotal >= r.minAmount;
    const maxOk = r.maxAmount == null || order.subtotal <= r.maxAmount;
    const stateOk = !r.state || r.state === state;
    if (minOk && maxOk && stateOk) {
      let amount = 0;
      if (r.type === 'percent') {
        amount = (order.subtotal * (Number(r.value) || 0)) / 100;
      } else {
        amount = Number(r.value) || 0;
      }
      charges.push({ id: r.id, label: r.label || r.id, amount, rule: r });
      totalCharge += amount;
    }
  }

  const taxProfile = taxProfiles[state] || taxProfiles['default'];
  let tax = 0;
  if (taxProfile && taxProfile.rate) {
    tax = ((order.subtotal + totalCharge) * Number(taxProfile.rate)) / 100;
  }

  return {
    subtotal: order.subtotal,
    charges,
    tax,
    total: order.subtotal + totalCharge + tax,
  };
};

export default {
  evaluateChargeRules,
  resolveMakingCharge,
};
