import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { PaymentGatewayConfiguration, Notification } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";
import crypto from "crypto";

const ALLOWED_GATEWAY_TYPES = ["RAZORPAY", "CASHFREE", "PHONEPE", "STRIPE"];

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

async function sendGatewayNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-PGW-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "PaymentGateway",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[PaymentGateway Notification] Failed:", err);
  }
}

/**
 * Simulate credential validation per gateway type.
 * In production, wire this to the actual SDK / REST validation endpoints.
 */
async function verifyGatewayCredentials(
  gatewayType: string,
  apiKey: string,
  secretKey: string,
  testMode: boolean
): Promise<{ valid: boolean; message: string }> {
  // Basic structural validation
  if (!apiKey || apiKey.length < 8) {
    return { valid: false, message: "API key is too short or invalid." };
  }
  if (!secretKey || secretKey.length < 8) {
    return { valid: false, message: "Secret key is too short or invalid." };
  }

  switch (gatewayType) {
    case "RAZORPAY":
      // Razorpay keys start with rzp_test_ or rzp_live_
      if (testMode && !apiKey.startsWith("rzp_test_")) {
        return { valid: false, message: "Razorpay test API keys must start with 'rzp_test_'." };
      }
      if (!testMode && !apiKey.startsWith("rzp_live_")) {
        return { valid: false, message: "Razorpay live API keys must start with 'rzp_live_'." };
      }
      break;
    case "CASHFREE":
      // Cashfree keys are alphanumeric
      if (!/^[a-zA-Z0-9_-]{8,}$/.test(apiKey)) {
        return { valid: false, message: "Cashfree App ID format is invalid." };
      }
      break;
    case "PHONEPE":
      if (!/^[a-zA-Z0-9_-]{4,}$/.test(apiKey)) {
        return { valid: false, message: "PhonePe merchant ID format is invalid." };
      }
      break;
    case "STRIPE":
      if (testMode && !apiKey.startsWith("sk_test_")) {
        return { valid: false, message: "Stripe test keys must start with 'sk_test_'." };
      }
      if (!testMode && !apiKey.startsWith("sk_live_")) {
        return { valid: false, message: "Stripe live keys must start with 'sk_live_'." };
      }
      break;
    default:
      return { valid: false, message: "Unsupported gateway type." };
  }

  return { valid: true, message: `${gatewayType} credentials appear structurally valid.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/payment-gateways
// ─────────────────────────────────────────────────────────────────────────────
export const createPaymentGateway = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { gatewayName, gatewayType, apiKey, secretKey, webhookSecret, isDefault, isActive, testMode } = req.body;

    if (!gatewayName || !gatewayType || !apiKey || !secretKey) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: gatewayName, gatewayType, apiKey, or secretKey.",
      });
    }

    if (!ALLOWED_GATEWAY_TYPES.includes(gatewayType)) {
      return res.status(400).json({ success: false, error: "Invalid gatewayType." });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    // Prevent duplicate gateway type per tenant
    const duplicate = await PaymentGatewayConfiguration.findOne({ tenantId, gatewayType });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `A ${gatewayType} configuration already exists for this store. Please edit the existing one.`,
      });
    }

    // Unset previous default if new one is requested
    if (isDefault) {
      await PaymentGatewayConfiguration.updateMany({ tenantId, isDefault: true }, { $set: { isDefault: false } });
    }

    const config = await PaymentGatewayConfiguration.create({
      gatewayName,
      gatewayType,
      apiKey,
      secretKey,
      webhookSecret: webhookSecret || undefined,
      isActive: isActive !== false,
      isDefault: !!isDefault,
      testMode: testMode !== false,
      tenantId,
      createdBy: user.id,
    });

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PAY_GATEWAY_CREATED",
      entityType: "PAYMENT_GATEWAY_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      newData: { gatewayName, gatewayType, isDefault: config.isDefault, testMode: config.testMode }
    });

    await sendGatewayNotification(
      tenantId,
      "PAYMENT_GATEWAY_CREATED",
      "Payment Gateway Added",
      `${gatewayName} (${gatewayType}) has been configured successfully.`
    );

    return res.status(201).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[PaymentGateway] createPaymentGateway error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/payment-gateways/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updatePaymentGateway = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PaymentGatewayConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Payment gateway configuration not found." });
    }

    const previousData = config.toObject();
    const { gatewayName, apiKey, secretKey, webhookSecret, isActive, isDefault, testMode } = req.body;

    // If setting this gateway as default, unset all others
    if (isDefault && !config.isDefault) {
      await PaymentGatewayConfiguration.updateMany(
        { tenantId, isDefault: true, _id: { $ne: id } },
        { $set: { isDefault: false } }
      );
    }

    if (gatewayName !== undefined) config.gatewayName = gatewayName;
    if (apiKey !== undefined) config.apiKey = apiKey;
    if (secretKey !== undefined) config.secretKey = secretKey;
    if (webhookSecret !== undefined) config.webhookSecret = webhookSecret;
    if (isActive !== undefined) config.isActive = isActive;
    if (isDefault !== undefined) config.isDefault = isDefault;
    if (testMode !== undefined) config.testMode = testMode;

    await config.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PAY_GATEWAY_UPDATED",
      entityType: "PAYMENT_GATEWAY_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      previousData,
      newData: config.toObject()
    });

    return res.status(200).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[PaymentGateway] updatePaymentGateway error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/payment-gateways
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentGateways = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const configs = await PaymentGatewayConfiguration.find({ tenantId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: configs.length,
      data: configs.map((c: any) => ({
        ...c.toObject(),
        apiKey: c.apiKey ? `${c.apiKey.substring(0, 6)}${"*".repeat(Math.max(0, c.apiKey.length - 6))}` : undefined,
        secretKey: "**************",
        webhookSecret: c.webhookSecret ? "**************" : undefined,
      })),
    });
  } catch (err: any) {
    console.error("[PaymentGateway] getPaymentGateways error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/payment-gateways/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentGatewayById = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PaymentGatewayConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Payment gateway configuration not found." });
    }

    const user = req.user!;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user.role);
    const data = config.toObject();

    if (!isAdmin) {
      data.apiKey = `${data.apiKey?.substring(0, 6)}${"*".repeat(Math.max(0, (data.apiKey?.length || 0) - 6))}`;
      data.secretKey = "**************";
      data.webhookSecret = data.webhookSecret ? "**************" : undefined;
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("[PaymentGateway] getPaymentGatewayById error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/settings/payment-gateways/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deletePaymentGateway = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PaymentGatewayConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Payment gateway configuration not found." });
    }

    // Prevent deletion of active default gateway
    if (config.isDefault && config.isActive) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete the active default payment gateway. Please set another gateway as default first.",
      });
    }

    const auditCtx = buildAuditContextFromRequest(req);
    const previousData = config.toObject();

    await PaymentGatewayConfiguration.deleteOne({ _id: id, tenantId });

    await financeAuditService.log({
      actionType: "PAY_GATEWAY_DEACTIVATED",
      entityType: "PAYMENT_GATEWAY_CONFIGURATION",
      entityId: String(id),
      context: auditCtx,
      previousData,
      newData: null
    });

    await sendGatewayNotification(
      tenantId,
      "PAYMENT_GATEWAY_DELETED",
      "Payment Gateway Removed",
      `${config.gatewayName} (${config.gatewayType}) configuration has been deleted.`
    );

    return res.status(200).json({ success: true, message: "Payment gateway configuration deleted successfully." });
  } catch (err: any) {
    console.error("[PaymentGateway] deletePaymentGateway error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/payment-gateways/test
// ─────────────────────────────────────────────────────────────────────────────
export const testPaymentGateway = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id, gatewayType, apiKey, secretKey, testMode } = req.body;

    // Support either testing a saved gateway by ID, or testing raw credentials
    let resolvedType = gatewayType;
    let resolvedKey = apiKey;
    let resolvedSecret = secretKey;
    let resolvedTestMode = testMode !== false;

    if (id && isDbConnected()) {
      const config = await PaymentGatewayConfiguration.findOne({ _id: id, tenantId });
      if (!config) {
        return res.status(404).json({ success: false, error: "Payment gateway configuration not found." });
      }
      resolvedType = config.gatewayType;
      resolvedKey = config.apiKey;
      resolvedSecret = config.secretKey;
      resolvedTestMode = config.testMode;
    }

    if (!resolvedType || !resolvedKey || !resolvedSecret) {
      return res.status(400).json({
        success: false,
        error: "Missing gatewayType, apiKey, or secretKey for testing.",
      });
    }

    const result = await verifyGatewayCredentials(resolvedType, resolvedKey, resolvedSecret, resolvedTestMode);

    if (id && isDbConnected()) {
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "PAY_GATEWAY_TESTED",
        entityType: "PAYMENT_GATEWAY_CONFIGURATION",
        entityId: String(id),
        context: auditCtx,
        newData: { result }
      });

      await sendGatewayNotification(
        tenantId,
        "PAYMENT_GATEWAY_TESTED",
        "Payment Gateway Test",
        `${resolvedType} gateway test ${result.valid ? "passed" : "failed"}: ${result.message}`
      );
    }

    return res.status(200).json({
      success: true,
      valid: result.valid,
      message: result.message,
      testedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[PaymentGateway] testPaymentGateway error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/settings/payment-gateways/:id/set-default
// ─────────────────────────────────────────────────────────────────────────────
export const setDefaultPaymentGateway = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PaymentGatewayConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Payment gateway configuration not found." });
    }

    if (!config.isActive) {
      return res.status(400).json({
        success: false,
        error: "Cannot set an inactive gateway as default. Please activate it first.",
      });
    }

    // Unset all other defaults
    await PaymentGatewayConfiguration.updateMany(
      { tenantId, isDefault: true, _id: { $ne: id } },
      { $set: { isDefault: false } }
    );

    config.isDefault = true;
    await config.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PAY_GATEWAY_DEFAULT_CHANGED",
      entityType: "PAYMENT_GATEWAY_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      newData: { gatewayName: config.gatewayName, gatewayType: config.gatewayType }
    });

    await sendGatewayNotification(
      tenantId,
      "PAYMENT_GATEWAY_DEFAULT_CHANGED",
      "Default Gateway Changed",
      `${config.gatewayName} (${config.gatewayType}) is now the default payment gateway.`
    );

    return res.status(200).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[PaymentGateway] setDefaultPaymentGateway error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/settings/payment-gateways/:id/toggle-status
// ─────────────────────────────────────────────────────────────────────────────
export const togglePaymentGatewayStatus = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PaymentGatewayConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Payment gateway configuration not found." });
    }

    const previousActive = config.isActive;
    config.isActive = !config.isActive;

    // Removing default if deactivating
    if (!config.isActive && config.isDefault) {
      config.isDefault = false;
    }

    await config.save();

    const actionType = config.isActive ? "PAY_GATEWAY_ACTIVATED" : "PAY_GATEWAY_DEACTIVATED";
    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: actionType as any,
      entityType: "PAYMENT_GATEWAY_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      previousData: { isActive: previousActive },
      newData: { isActive: config.isActive }
    });

    await sendGatewayNotification(
      tenantId,
      actionType,
      config.isActive ? "Gateway Activated" : "Gateway Deactivated",
      `${config.gatewayName} (${config.gatewayType}) has been ${config.isActive ? "activated" : "deactivated"}.`
    );

    return res.status(200).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[PaymentGateway] togglePaymentGatewayStatus error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};
