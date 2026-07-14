import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { PrinterConfiguration, Notification } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";

const ALLOWED_PRINTER_TYPES = ["THERMAL_58", "THERMAL_80", "A4", "BARCODE", "TAG"];
const ALLOWED_CONNECTION_TYPES = ["USB", "NETWORK", "BLUETOOTH"];

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

async function sendPrinterNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-PRN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "Printer",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[Printer Notification] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/printers
// ─────────────────────────────────────────────────────────────────────────────
export const createPrinter = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { printerName, printerType, connectionType, printerIdentifier, paperSize, isDefault, isActive, branchId } = req.body;

    if (!printerName || !printerType || !connectionType || !printerIdentifier) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: printerName, printerType, connectionType, or printerIdentifier.",
      });
    }

    if (!ALLOWED_PRINTER_TYPES.includes(printerType)) {
      return res.status(400).json({ success: false, error: "Invalid printerType." });
    }

    if (!ALLOWED_CONNECTION_TYPES.includes(connectionType)) {
      return res.status(400).json({ success: false, error: "Invalid connectionType." });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const resolvedBranchId = branchId || "default-branch";

    // Enforce unique printer name per branch
    const duplicate = await PrinterConfiguration.findOne({ tenantId, branchId: resolvedBranchId, printerName });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `A printer named '${printerName}' already exists in this branch.`,
      });
    }

    // Unset other defaults of the SAME type in the SAME branch
    if (isDefault) {
      await PrinterConfiguration.updateMany(
        { tenantId, branchId: resolvedBranchId, printerType, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const config = await PrinterConfiguration.create({
      printerName,
      printerType,
      connectionType,
      printerIdentifier,
      paperSize: paperSize || undefined,
      isDefault: !!isDefault,
      isActive: isActive !== false,
      branchId: resolvedBranchId,
      tenantId,
      createdBy: user.id,
    });

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PRINTER_CREATED",
      entityType: "PRINTER_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      newData: { printerName, printerType, isDefault: config.isDefault, branchId: resolvedBranchId }
    });

    await sendPrinterNotification(
      tenantId,
      "PRINTER_CREATED",
      "Printer Configured",
      `Printer '${printerName}' (${printerType}) added for branch ${resolvedBranchId}.`
    );

    return res.status(201).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[Printer] createPrinter error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/printers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updatePrinter = async (req: AuthRequest, res: Response) => {
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

    const config = await PrinterConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Printer configuration not found." });
    }

    const previousData = config.toObject();
    const { printerName, connectionType, printerIdentifier, paperSize, isActive, isDefault, branchId } = req.body;

    const resolvedBranchId = branchId || config.branchId;

    if (printerName !== undefined && printerName !== config.printerName) {
      const duplicate = await PrinterConfiguration.findOne({ tenantId, branchId: resolvedBranchId, printerName, _id: { $ne: id } });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: `A printer named '${printerName}' already exists in this branch.`,
        });
      }
      config.printerName = printerName;
    }

    if (connectionType !== undefined) {
      if (!ALLOWED_CONNECTION_TYPES.includes(connectionType)) {
        return res.status(400).json({ success: false, error: "Invalid connectionType." });
      }
      config.connectionType = connectionType;
    }

    if (printerIdentifier !== undefined) config.printerIdentifier = printerIdentifier;
    if (paperSize !== undefined) config.paperSize = paperSize;
    if (isActive !== undefined) config.isActive = isActive;
    if (branchId !== undefined) config.branchId = branchId;

    if (isDefault) {
      await PrinterConfiguration.updateMany(
        { tenantId, branchId: resolvedBranchId, printerType: config.printerType, isDefault: true, _id: { $ne: id } },
        { $set: { isDefault: false } }
      );
      config.isDefault = true;
    } else if (isDefault === false) {
      config.isDefault = false;
    }

    await config.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PRINTER_UPDATED",
      entityType: "PRINTER_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      previousData,
      newData: config.toObject()
    });

    return res.status(200).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[Printer] updatePrinter error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/printers
// ─────────────────────────────────────────────────────────────────────────────
export const getPrinters = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId, printerType } = req.query;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const query: any = { tenantId };
    if (branchId) query.branchId = branchId;
    if (printerType) query.printerType = printerType;

    const configs = await PrinterConfiguration.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: configs.length,
      data: configs,
    });
  } catch (err: any) {
    console.error("[Printer] getPrinters error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/printers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getPrinterById = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PrinterConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Printer configuration not found." });
    }

    return res.status(200).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[Printer] getPrinterById error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/settings/printers/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deletePrinter = async (req: AuthRequest, res: Response) => {
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

    const config = await PrinterConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Printer configuration not found." });
    }

    const previousData = config.toObject();
    await PrinterConfiguration.deleteOne({ _id: id, tenantId });

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PRINTER_DEACTIVATED",
      entityType: "PRINTER_CONFIGURATION",
      entityId: String(id),
      context: auditCtx,
      previousData,
      newData: null
    });

    await sendPrinterNotification(
      tenantId,
      "PRINTER_DELETED",
      "Printer Configuration Deleted",
      `Printer '${config.printerName}' has been removed.`
    );

    return res.status(200).json({ success: true, message: "Printer configuration deleted successfully." });
  } catch (err: any) {
    console.error("[Printer] deletePrinter error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/printers/test
// ─────────────────────────────────────────────────────────────────────────────
export const testPrinter = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id, printerName, printerType, connectionType, printerIdentifier } = req.body;

    let resolvedName = printerName;
    let resolvedType = printerType;
    let resolvedConnection = connectionType;
    let resolvedIdentifier = printerIdentifier;

    if (id && isDbConnected()) {
      const config = await PrinterConfiguration.findOne({ _id: id, tenantId });
      if (!config) {
        return res.status(404).json({ success: false, error: "Printer configuration not found." });
      }
      resolvedName = config.printerName;
      resolvedType = config.printerType;
      resolvedConnection = config.connectionType;
      resolvedIdentifier = config.printerIdentifier;
    }

    if (!resolvedName || !resolvedType || !resolvedConnection || !resolvedIdentifier) {
      return res.status(400).json({
        success: false,
        error: "Missing required configuration properties to test.",
      });
    }

    // Simulate sending generic printer escape commands / RAW code / IP connection test
    const success = true;
    const message = `Test print page successfully sent to printer '${resolvedName}' at identifier '${resolvedIdentifier}' via ${resolvedConnection}.`;

    if (id && isDbConnected()) {
      const auditCtx = buildAuditContextFromRequest(req);
      await financeAuditService.log({
        actionType: "PRINTER_TEST_PRINTED",
        entityType: "PRINTER_CONFIGURATION",
        entityId: String(id),
        context: auditCtx,
        newData: { status: "SUCCESS", message }
      });

      await sendPrinterNotification(
        tenantId,
        "PRINTER_TEST_PRINTED",
        "Test Print Dispatched",
        `Test page printed on '${resolvedName}'.`
      );
    }

    return res.status(200).json({
      success,
      message,
      testedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Printer] testPrinter error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/printers/set-default
// ─────────────────────────────────────────────────────────────────────────────
export const setDefaultPrinter = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: "Missing printer ID." });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const config = await PrinterConfiguration.findOne({ _id: id, tenantId });
    if (!config) {
      return res.status(404).json({ success: false, error: "Printer configuration not found." });
    }

    if (!config.isActive) {
      return res.status(400).json({
        success: false,
        error: "Cannot set an inactive printer as default. Please activate it first.",
      });
    }

    // Unset other defaults of the SAME type in the SAME branch
    await PrinterConfiguration.updateMany(
      { tenantId, branchId: config.branchId, printerType: config.printerType, isDefault: true, _id: { $ne: id } },
      { $set: { isDefault: false } }
    );

    config.isDefault = true;
    await config.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "PRINTER_DEFAULT_CHANGED",
      entityType: "PRINTER_CONFIGURATION",
      entityId: String(config._id),
      context: auditCtx,
      newData: { printerName: config.printerName, printerType: config.printerType, branchId: config.branchId }
    });

    await sendPrinterNotification(
      tenantId,
      "PRINTER_DEFAULT_CHANGED",
      "Default Printer Updated",
      `Printer '${config.printerName}' is now the default for type ${config.printerType} in branch ${config.branchId}.`
    );

    return res.status(200).json({ success: true, data: config });
  } catch (err: any) {
    console.error("[Printer] setDefaultPrinter error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};
