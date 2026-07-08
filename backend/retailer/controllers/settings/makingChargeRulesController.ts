import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { MakingChargeRule, Notification } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { randomUUID } from "crypto";
import { resolveMakingCharge } from "../../../lib/chargeEngine.js";

// Offline Fallback Memory Storage
let fallbackRules: any[] = [];

const generateRuleId = () => `MCR-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

async function sendRuleNotification(type: string, title: string, message: string) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-${Date.now().toString(36).toUpperCase()}`,
        type,
        title,
        message,
        category: "System",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[MakingChargeRule Notification] failed:", err);
  }
}

/**
 * POST /api/settings/making-charge-rules
 */
export const createRule = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied. Admin or Manager role required." });
    }

    const {
      ruleName,
      ruleType,
      metalType,
      category,
      subCategory,
      purity,
      productId,
      customerId,
      branchId,
      calculationMethod,
      value,
      minValue,
      maxValue,
      priority,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    if (!ruleName || !ruleType || !metalType || !calculationMethod || value == null) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    const ruleId = generateRuleId();
    const newRule = {
      ruleId,
      ruleName,
      ruleType,
      metalType,
      category: category || "",
      subCategory: subCategory || "",
      purity: purity || "",
      productId: productId || "",
      customerId: customerId || "",
      branchId: branchId || "",
      calculationMethod,
      value: Number(value),
      minValue: minValue != null ? Number(minValue) : null,
      maxValue: maxValue != null ? Number(maxValue) : null,
      priority: priority != null ? Number(priority) : 100,
      isActive: true,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      createdBy: user.email || user.id,
      lastUpdatedAt: new Date(),
    };

    if (isDbConnected()) {
      const created = await MakingChargeRule.create(newRule);
      await sendRuleNotification("RULE_CREATED", "Making Charge Rule Created", `Rule '${ruleName}' created by ${user.email}`);
      return res.status(201).json({ success: true, data: created });
    } else {
      fallbackRules.push(newRule);
      return res.status(201).json({ success: true, data: newRule });
    }
  } catch (error: any) {
    console.error("createRule error:", error);
    return res.status(500).json({ success: false, error: "Failed to create rule." });
  }
};

/**
 * PUT /api/settings/making-charge-rules/:id
 */
export const updateRule = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;
    const updates = req.body;

    if (updates.value != null) updates.value = Number(updates.value);
    if (updates.minValue != null) updates.minValue = Number(updates.minValue);
    if (updates.maxValue != null) updates.maxValue = Number(updates.maxValue);
    if (updates.priority != null) updates.priority = Number(updates.priority);
    if (updates.effectiveFrom) updates.effectiveFrom = new Date(updates.effectiveFrom);
    if (updates.effectiveTo) updates.effectiveTo = new Date(updates.effectiveTo);
    updates.updatedBy = user.email || user.id;
    updates.lastUpdatedAt = new Date();

    if (isDbConnected()) {
      const updated = await MakingChargeRule.findOneAndUpdate({ ruleId: id }, { $set: updates }, { new: true });
      if (!updated) return res.status(404).json({ success: false, error: "Rule not found." });
      await sendRuleNotification("RULE_UPDATED", "Making Charge Rule Updated", `Rule '${updated.ruleName}' updated by ${user.email}`);
      return res.json({ success: true, data: updated });
    } else {
      const idx = fallbackRules.findIndex(r => r.ruleId === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Rule not found." });
      fallbackRules[idx] = { ...fallbackRules[idx], ...updates };
      return res.json({ success: true, data: fallbackRules[idx] });
    }
  } catch (error: any) {
    console.error("updateRule error:", error);
    return res.status(500).json({ success: false, error: "Failed to update rule." });
  }
};

/**
 * GET /api/settings/making-charge-rules
 */
export const getRules = async (req: AuthRequest, res: Response) => {
  try {
    if (isDbConnected()) {
      const rules = await MakingChargeRule.find({}).sort({ createdAt: -1 });
      return res.json({ success: true, data: rules });
    } else {
      return res.json({ success: true, data: fallbackRules });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to retrieve rules." });
  }
};

/**
 * GET /api/settings/making-charge-rules/:id
 */
export const getRuleById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (isDbConnected()) {
      const rule = await MakingChargeRule.findOne({ ruleId: id });
      if (!rule) return res.status(404).json({ success: false, error: "Rule not found." });
      return res.json({ success: true, data: rule });
    } else {
      const rule = fallbackRules.find(r => r.ruleId === id);
      if (!rule) return res.status(404).json({ success: false, error: "Rule not found." });
      return res.json({ success: true, data: rule });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to retrieve rule." });
  }
};

/**
 * DELETE /api/settings/making-charge-rules/:id
 */
export const deleteRule = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;
    if (isDbConnected()) {
      const deleted = await MakingChargeRule.findOneAndDelete({ ruleId: id });
      if (!deleted) return res.status(404).json({ success: false, error: "Rule not found." });
      await sendRuleNotification("RULE_DEACTIVATED", "Making Charge Rule Deleted", `Rule '${deleted.ruleName}' was deleted.`);
      return res.json({ success: true, data: deleted });
    } else {
      const idx = fallbackRules.findIndex(r => r.ruleId === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Rule not found." });
      const deleted = fallbackRules.splice(idx, 1)[0];
      return res.json({ success: true, data: deleted });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to delete rule." });
  }
};

/**
 * POST /api/settings/making-charge-rules/calculate
 */
export const calculateMakingCharge = async (req: AuthRequest, res: Response) => {
  try {
    const {
      metalType,
      category,
      subCategory,
      purity,
      weight,
      quantity,
      productValue,
      productId,
      customerId,
      branchId,
    } = req.body;

    if (!metalType) {
      return res.status(400).json({ success: false, error: "metalType is required." });
    }

    const result = await resolveMakingCharge({
      metalType,
      category,
      subCategory,
      purity,
      weight: Number(weight || 0),
      quantity: Number(quantity || 1),
      productValue: Number(productValue || 0),
      productId,
      customerId,
      branchId,
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("calculateMakingCharge error:", error);
    return res.status(500).json({ success: false, error: "Calculation failed." });
  }
};
