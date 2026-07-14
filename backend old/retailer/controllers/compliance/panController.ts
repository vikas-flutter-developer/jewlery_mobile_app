import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { Customer, Notification } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

export function isValidPanFormat(pan: string): boolean {
  if (!pan || pan.length !== 10) return false;
  return PAN_PATTERN.test(pan.toUpperCase());
}

async function sendPanNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-PAN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
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
    console.error("[PAN Notification] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pan/validate
// ─────────────────────────────────────────────────────────────────────────────
export const validatePan = async (req: AuthRequest, res: Response) => {
  try {
    const { panNumber, customerId } = req.body;
    const tenantId = getTenantId(req);

    if (!panNumber) {
      return res.status(400).json({ success: false, error: "Missing panNumber." });
    }

    const cleanPan = String(panNumber).trim().toUpperCase();

    if (!isValidPanFormat(cleanPan)) {
      return res.status(200).json({
        success: true,
        valid: false,
        reason: "Invalid PAN format. Must be 10 characters matching standard Indian Income Tax pattern (e.g. ABCDE1234F).",
      });
    }

    if (isDbConnected()) {
      const query: any = { tenantId, panNumber: cleanPan };
      if (customerId) {
        query._id = { $ne: customerId };
      }
      const duplicate = await Customer.findOne(query);
      if (duplicate) {
        return res.status(200).json({
          success: true,
          valid: false,
          reason: `Duplicate PAN. Already registered to customer: ${duplicate.name} (${duplicate.phone}).`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      valid: true,
      panNumber: cleanPan,
    });
  } catch (err: any) {
    console.error("[PAN] validatePan error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pan/verify
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPan = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "STORE_MANAGER"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { customerId, panNumber, status } = req.body;
    console.log("[PAN Verify] body:", req.body, "tenantId:", tenantId);

    if (!customerId) {
      return res.status(400).json({ success: false, error: "Missing customerId." });
    }

    if (!status || !["VERIFIED", "INVALID", "PENDING"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status value." });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId });
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found." });
    }

    const activePan = panNumber ? String(panNumber).trim().toUpperCase() : customer.panNumber;

    if (!activePan) {
      return res.status(400).json({ success: false, error: "No PAN number provided or recorded on profile." });
    }

    if (!isValidPanFormat(activePan)) {
      return res.status(400).json({ success: false, error: "Cannot verify invalid PAN format." });
    }

    // Check duplicate
    const duplicate = await Customer.findOne({
      tenantId,
      panNumber: activePan,
      _id: { $ne: customer._id },
    });
    if (duplicate) {
      return res.status(400).json({ success: false, error: "Duplicate PAN detected on another customer." });
    }

    const previousData = customer.toObject();

    customer.panNumber = activePan;
    customer.pan = activePan; // sync with old field
    customer.panStatus = status;
    customer.panVerifiedAt = status === "VERIFIED" ? new Date() : undefined;
    customer.panVerifiedBy = status === "VERIFIED" ? user.email || user.id : undefined;

    await customer.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: status === "VERIFIED" ? "PAN_VERIFIED" : "PAN_VALIDATION_FAILED",
      entityType: "CUSTOMER" as any,
      entityId: String(customer._id),
      context: auditCtx,
      previousData,
      newData: customer.toObject(),
    });

    await sendPanNotification(
      tenantId,
      status === "VERIFIED" ? "PAN_VERIFIED" : "PAN_FAILED",
      status === "VERIFIED" ? "PAN Verified Successfully" : "PAN Verification Failed",
      `PAN ${activePan} for customer ${customer.name} marked as ${status}.`
    );

    return res.status(200).json({
      success: true,
      message: `PAN verification status set to ${status}.`,
      data: customer,
    });
  } catch (err: any) {
    console.error("[PAN] verifyPan error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pan/:customerId
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerPanDetails = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { customerId } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const customer = await Customer.findOne({ _id: customerId, tenantId });
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found." });
    }

    return res.status(200).json({
      success: true,
      customerId,
      panNumber: customer.panNumber || customer.pan || null,
      panStatus: customer.panStatus || "PENDING",
      panVerifiedAt: customer.panVerifiedAt || null,
      panVerifiedBy: customer.panVerifiedBy || null,
    });
  } catch (err: any) {
    console.error("[PAN] getCustomerPanDetails error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};
