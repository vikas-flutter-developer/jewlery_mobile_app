import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { BISLicence, Notification } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

async function sendBisNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-BIS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "Compliance",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[BIS Notification] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/bis-licence
// ─────────────────────────────────────────────────────────────────────────────
export const createBisLicence = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { licenceNumber, licenceHolderName, issuingAuthority, issueDate, expiryDate, branchId, isActive, remarks, status } = req.body;

    if (!licenceNumber || !licenceHolderName || !issuingAuthority || !issueDate || !expiryDate || !branchId) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    // Check duplicate licence number
    const duplicate = await BISLicence.findOne({ tenantId, licenceNumber: licenceNumber.trim() });
    if (duplicate) {
      return res.status(400).json({ success: false, error: "Licence number already registered." });
    }

    // Expiry check
    const today = new Date();
    const expiry = new Date(expiryDate);
    const resolvedStatus = status || (expiry < today ? "EXPIRED" : "ACTIVE");
    const resolvedIsActive = isActive !== undefined ? isActive : (resolvedStatus === "ACTIVE");

    // Deactivate others if setting this one as active
    if (resolvedIsActive && resolvedStatus === "ACTIVE") {
      await BISLicence.updateMany(
        { tenantId, branchId, isActive: true },
        { $set: { isActive: false, status: "SUSPENDED" } }
      );
    }

    const licence = await BISLicence.create({
      licenceNumber: licenceNumber.trim(),
      licenceHolderName: licenceHolderName.trim(),
      issuingAuthority: issuingAuthority.trim(),
      issueDate: new Date(issueDate),
      expiryDate: expiry,
      branchId,
      isActive: resolvedIsActive,
      status: resolvedStatus,
      remarks,
      tenantId,
    });

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "BIS_LICENCE_CREATED",
      entityType: "BIS_LICENCE",
      entityId: String(licence._id),
      context: auditCtx,
      newData: licence.toObject(),
    });

    await sendBisNotification(
      tenantId,
      "BIS_CREATED",
      "BIS Licence Registered",
      `Licence ${licence.licenceNumber} registered for branch ${licence.branchId}.`
    );

    return res.status(201).json({ success: true, data: licence });
  } catch (err: any) {
    console.error("[BIS] createBisLicence error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/bis-licence/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateBisLicence = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;
    const updates = req.body;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const licence = await BISLicence.findOne({ _id: id, tenantId });
    if (!licence) {
      return res.status(404).json({ success: false, error: "BIS Licence not found." });
    }

    if (updates.licenceNumber) {
      const duplicate = await BISLicence.findOne({
        tenantId,
        licenceNumber: updates.licenceNumber.trim(),
        _id: { $ne: licence._id },
      });
      if (duplicate) {
        return res.status(400).json({ success: false, error: "Licence number already registered." });
      }
    }

    const previousData = licence.toObject();

    if (updates.licenceNumber) licence.licenceNumber = updates.licenceNumber.trim();
    if (updates.licenceHolderName) licence.licenceHolderName = updates.licenceHolderName.trim();
    if (updates.issuingAuthority) licence.issuingAuthority = updates.issuingAuthority.trim();
    if (updates.issueDate) licence.issueDate = new Date(updates.issueDate);
    if (updates.expiryDate) {
      licence.expiryDate = new Date(updates.expiryDate);
      if (licence.expiryDate < new Date()) {
        licence.status = "EXPIRED";
        licence.isActive = false;
      }
    }
    if (updates.branchId) licence.branchId = updates.branchId;
    if (updates.remarks !== undefined) licence.remarks = updates.remarks;
    if (updates.status) licence.status = updates.status;
    if (updates.isActive !== undefined) licence.isActive = updates.isActive;

    if (licence.isActive && licence.status === "ACTIVE") {
      // Deactivate all others for this branch
      await BISLicence.updateMany(
        { tenantId, branchId: licence.branchId, _id: { $ne: licence._id }, isActive: true },
        { $set: { isActive: false, status: "SUSPENDED" } }
      );
    }

    await licence.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "BIS_LICENCE_UPDATED",
      entityType: "BIS_LICENCE",
      entityId: String(licence._id),
      context: auditCtx,
      previousData,
      newData: licence.toObject(),
    });

    return res.status(200).json({ success: true, data: licence });
  } catch (err: any) {
    console.error("[BIS] updateBisLicence error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/bis-licence
// ─────────────────────────────────────────────────────────────────────────────
export const getBisLicences = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId, status } = req.query;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const query: any = { tenantId };
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;

    const list = await BISLicence.find(query).sort({ expiryDate: 1 });

    return res.status(200).json({ success: true, data: list });
  } catch (err: any) {
    console.error("[BIS] getBisLicences error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/bis-licence/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getBisLicenceById = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const licence = await BISLicence.findOne({ _id: id, tenantId });
    if (!licence) {
      return res.status(404).json({ success: false, error: "BIS Licence not found." });
    }

    return res.status(200).json({ success: true, data: licence });
  } catch (err: any) {
    console.error("[BIS] getBisLicenceById error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/bis-licence/:id/activate
// ─────────────────────────────────────────────────────────────────────────────
export const activateBisLicence = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const licence = await BISLicence.findOne({ _id: id, tenantId });
    if (!licence) {
      return res.status(404).json({ success: false, error: "BIS Licence not found." });
    }

    if (licence.expiryDate < new Date()) {
      return res.status(400).json({ success: false, error: "Cannot activate an expired licence." });
    }

    const previousData = licence.toObject();

    // Deactivate all others for this branch first
    await BISLicence.updateMany(
      { tenantId, branchId: licence.branchId, isActive: true },
      { $set: { isActive: false, status: "SUSPENDED" } }
    );

    licence.isActive = true;
    licence.status = "ACTIVE";
    await licence.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "BIS_LICENCE_ACTIVATED",
      entityType: "BIS_LICENCE",
      entityId: String(licence._id),
      context: auditCtx,
      previousData,
      newData: licence.toObject(),
    });

    await sendBisNotification(
      tenantId,
      "BIS_ACTIVATED",
      "BIS Licence Activated",
      `Licence ${licence.licenceNumber} activated for branch ${licence.branchId}.`
    );

    return res.status(200).json({ success: true, data: licence });
  } catch (err: any) {
    console.error("[BIS] activateBisLicence error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/bis-licence/:id/suspend
// ─────────────────────────────────────────────────────────────────────────────
export const suspendBisLicence = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "COMPLIANCE_MANAGER", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const licence = await BISLicence.findOne({ _id: id, tenantId });
    if (!licence) {
      return res.status(404).json({ success: false, error: "BIS Licence not found." });
    }

    const previousData = licence.toObject();

    licence.isActive = false;
    licence.status = "SUSPENDED";
    await licence.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "BIS_LICENCE_SUSPENDED",
      entityType: "BIS_LICENCE",
      entityId: String(licence._id),
      context: auditCtx,
      previousData,
      newData: licence.toObject(),
    });

    await sendBisNotification(
      tenantId,
      "BIS_SUSPENDED",
      "BIS Licence Suspended",
      `Licence ${licence.licenceNumber} suspended for branch ${licence.branchId}.`
    );

    return res.status(200).json({ success: true, data: licence });
  } catch (err: any) {
    console.error("[BIS] suspendBisLicence error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports Endpoints
// ─────────────────────────────────────────────────────────────────────────────
export const getBisLicencesReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { branchId, status, expiryDate } = req.query;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const query: any = { tenantId };
    if (branchId) query.branchId = branchId;
    if (status) query.status = status;
    if (expiryDate) query.expiryDate = { $lte: new Date(expiryDate as string) };

    const list = await BISLicence.find(query).sort({ expiryDate: 1 });

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      filters: { branchId, status, expiryDate },
      data: list,
    });
  } catch (err: any) {
    console.error("[BIS] getBisLicencesReport error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};
