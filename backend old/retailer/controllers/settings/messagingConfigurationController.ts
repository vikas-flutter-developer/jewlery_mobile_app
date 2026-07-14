import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { MessagingConfiguration, Notification } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";
import nodemailer from "nodemailer";

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

async function sendMessagingConfigNotification(tenantId: string, type: string, title: string, message: string) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-MC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "MessagingConfiguration",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[MessagingConfiguration Notification] Failed:", err);
  }
}

/**
 * POST /api/settings/messaging
 */
export const createMessagingConfig = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { channelType, provider, configuration, isDefault, isActive } = req.body;

    if (!channelType || !provider || !configuration) {
      return res.status(400).json({ success: false, error: "Missing required fields: channelType, provider, or configuration." });
    }

    if (!["EMAIL", "SMS", "WHATSAPP"].includes(channelType)) {
      return res.status(400).json({ success: false, error: "Invalid channelType." });
    }

    if (isDbConnected()) {
      // Prevent duplicate provider per tenant + channel
      const duplicate = await MessagingConfiguration.findOne({ tenantId, channelType, provider });
      if (duplicate) {
        return res.status(400).json({ success: false, error: "A configuration for this provider and channel already exists." });
      }

      if (isDefault) {
        // Unset previous defaults for this channel
        await MessagingConfiguration.updateMany({ tenantId, channelType, isDefault: true }, { $set: { isDefault: false } });
      }

      // Check if this is the first config for this channel, make it default if not specified
      const count = await MessagingConfiguration.countDocuments({ tenantId, channelType });
      const finalIsDefault = count === 0 ? true : !!isDefault;

      const newConfig = await MessagingConfiguration.create({
        channelType,
        provider,
        configuration,
        isDefault: finalIsDefault,
        isActive: isActive !== false,
        createdBy: user.email,
        tenantId,
      });

      // Audit Log
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "MSG_CONFIG_CREATED",
        entityType: "MESSAGING_CONFIGURATION",
        entityId: String(newConfig._id),
        newData: newConfig.toObject(),
        context: auditCtx
      });

      // Notification
      await sendMessagingConfigNotification(tenantId, "MSG_CONFIG_CREATED", "Messaging Config Created", `Messaging config for ${channelType} (${provider}) has been created.`);

      return res.status(201).json({ success: true, data: newConfig });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to create messaging configuration." });
  }
};

/**
 * PUT /api/settings/messaging/:id
 */
export const updateMessagingConfig = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { provider, configuration, isDefault, isActive } = req.body;

    if (isDbConnected()) {
      const configDoc = await MessagingConfiguration.findOne({ _id: id, tenantId });
      if (!configDoc) {
        return res.status(404).json({ success: false, error: "Messaging configuration not found." });
      }

      const prevData = configDoc.toObject();

      if (provider !== undefined) configDoc.provider = provider;
      if (configuration !== undefined) configDoc.configuration = configuration;

      if (isActive !== undefined) {
        configDoc.isActive = isActive;
        if (isActive === false) {
          configDoc.isDefault = false;
        }
      }

      if (isDefault !== undefined) {
        if (isDefault && !configDoc.isActive) {
          return res.status(400).json({ success: false, error: "Cannot set inactive configuration as default." });
        }
        if (isDefault) {
          // Unset other defaults for this channel
          await MessagingConfiguration.updateMany(
            { tenantId, channelType: configDoc.channelType, _id: { $ne: id } },
            { $set: { isDefault: false } }
          );
        }
        configDoc.isDefault = isDefault;
      }

      await configDoc.save();

      // Audit Log
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "MSG_CONFIG_UPDATED",
        entityType: "MESSAGING_CONFIGURATION",
        entityId: String(configDoc._id),
        previousData,
        newData: configDoc.toObject(),
        context: auditCtx
      });

      // Notification
      await sendMessagingConfigNotification(tenantId, "MSG_CONFIG_UPDATED", "Messaging Config Updated", `Messaging config for ${configDoc.channelType} (${configDoc.provider}) has been updated.`);

      return res.status(200).json({ success: true, data: configDoc });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to update messaging configuration." });
  }
};

/**
 * GET /api/settings/messaging
 */
export const getMessagingConfigs = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (isDbConnected()) {
      const configs = await MessagingConfiguration.find({ tenantId });
      return res.status(200).json({ success: true, data: configs });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch messaging configurations." });
  }
};

/**
 * GET /api/settings/messaging/:id
 */
export const getMessagingConfigById = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (isDbConnected()) {
      const config = await MessagingConfiguration.findOne({ _id: id, tenantId });
      if (!config) {
        return res.status(404).json({ success: false, error: "Messaging configuration not found." });
      }
      return res.status(200).json({ success: true, data: config });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch messaging configuration." });
  }
};

/**
 * DELETE /api/settings/messaging/:id
 */
export const deleteMessagingConfig = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (isDbConnected()) {
      const config = await MessagingConfiguration.findOne({ _id: id, tenantId });
      if (!config) {
        return res.status(404).json({ success: false, error: "Messaging configuration not found." });
      }

      await MessagingConfiguration.deleteOne({ _id: id });

      // Audit Log
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "MSG_CONFIG_DEACTIVATED", // Reused action log event
        entityType: "MESSAGING_CONFIGURATION",
        entityId: String(id),
        previousData: config.toObject(),
        context: auditCtx
      });

      // Notification
      await sendMessagingConfigNotification(tenantId, "MSG_CONFIG_DEACTIVATED", "Messaging Config Deleted", `Messaging config for ${config.channelType} (${config.provider}) has been deleted.`);

      return res.status(200).json({ success: true, message: "Messaging configuration deleted successfully." });
    } else {
      return res.status(503).json({ success: false, error: "Database not available" });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to delete messaging configuration." });
  }
};

/**
 * POST /api/settings/messaging/test
 */
export const testMessagingConfig = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { channelType, provider, configuration, testRecipient } = req.body;

    if (!channelType || !provider || !configuration || !testRecipient) {
      return res.status(400).json({ success: false, error: "Missing required fields: channelType, provider, configuration, or testRecipient." });
    }

    let success = false;
    let details = "";

    if (channelType === "EMAIL") {
      try {
        const { host, port, secure, auth } = configuration;
        const transporter = nodemailer.createTransport({
          host: host || "smtp.ethereal.email",
          port: Number(port || 587),
          secure: secure === true,
          auth: {
            user: auth?.user || "",
            pass: auth?.pass || "",
          },
        });
        await transporter.verify();
        success = true;
        details = "SMTP connection verified successfully.";
      } catch (err: any) {
        details = `SMTP Verification failed: ${err.message}`;
      }
    } else if (channelType === "SMS" || channelType === "WHATSAPP") {
      // Mock validation/send for Twilio/Meta/MSG91 APIs
      if (configuration.apiKey || configuration.authToken) {
        success = true;
        details = `Simulated API test call to ${provider} for ${channelType} successful.`;
      } else {
        details = "Missing required API keys or Auth Tokens in configuration.";
      }
    }

    const tenantId = getTenantId(req);

    // Audit Log
    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "MSG_CONFIG_TESTED",
      entityType: "MESSAGING_CONFIGURATION",
      entityId: "TEST-EXECUTION",
      newData: { channelType, provider, success, details },
      context: auditCtx
    });

    if (success) {
      return res.status(200).json({ success: true, message: "Configuration tested successfully.", details });
    } else {
      return res.status(400).json({ success: false, error: "Configuration test failed.", details });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to test configuration." });
  }
};
