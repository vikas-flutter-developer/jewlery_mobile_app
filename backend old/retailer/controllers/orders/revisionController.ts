import { Response } from "express";
import { randomUUID } from "crypto";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { DesignApprovalAuditLog, DesignRevision, Notification, Order } from "../../models/index.js";
import { getClientIp } from "../../../lib/authUtils.js";

const VALID_REVISION_STATUS = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"];

const generateAuditId = () => `DRA-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
const generateNotificationId = () => `NRV-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

async function appendRevisionAuditLog(
  orderId: string,
  designId: string,
  action: string,
  userId: string,
  userEmail: string | undefined,
  userRole: string | undefined,
  details: string
) {
  try {
    await DesignApprovalAuditLog.create({
      logId: generateAuditId(),
      orderId,
      designId,
      action,
      userId,
      userEmail: userEmail || "",
      userRole: userRole || "",
      details,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[RevisionAuditLog] Failed to write audit log:", error);
  }
}

async function sendRevisionNotification(
  type: string,
  title: string,
  message: string,
  orderId: string
) {
  try {
    await Notification.create({
      notificationId: generateNotificationId(),
      type,
      title,
      message,
      category: "Design Revision",
      severity: "INFO",
      channels: ["IN_APP"],
      relatedEntityId: orderId,
      reference: orderId,
      sendAt: new Date(),
      status: "PENDING",
    });
  } catch (error) {
    console.error("[RevisionNotification] Failed to create notification:", error);
  }
}

export const createRevision = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const { revisionReason, changeSummary, notes, images, status } = req.body;
    const user = req.user!;

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "DESIGNER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to create revisions" });
    }

    if (!orderId || !designId) {
      return res.status(400).json({ success: false, error: "orderId and designId are required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const closedStatuses = ["DELIVERED", "CANCELLED", "COMPLETED"];
    if (closedStatuses.includes(String(order.status).toUpperCase())) {
      return res.status(400).json({ success: false, error: "Cannot create revision on a closed order" });
    }

    const latestRevision = await DesignRevision.findOne({ orderId, designId }).sort({ revisionNumber: -1 });
    const revisionNumber = latestRevision ? latestRevision.revisionNumber + 1 : 1;
    const previousVersionId = latestRevision ? latestRevision._id.toString() : null;
    const computedStatus = typeof status === "string" && VALID_REVISION_STATUS.includes(status) ? status : "SUBMITTED";

    const normalizedImages = Array.isArray(images)
      ? images
          .map((item: any) => {
            if (typeof item === "string") return { url: item, caption: "" };
            if (item && typeof item === "object" && item.url) {
              return { url: String(item.url), caption: String(item.caption || "") };
            }
            return null;
          })
          .filter((item: any) => item && String(item.url).trim())
      : [];

    const revision = await DesignRevision.create({
      orderId,
      designId,
      revisionNumber,
      previousVersionId,
      createdBy: user.id,
      createdByEmail: user.email || "",
      createdByRole: user.role,
      revisionReason: String(revisionReason || "").trim(),
      changeSummary: String(changeSummary || "").trim(),
      images: normalizedImages,
      notes: String(notes || "").trim(),
      status: computedStatus,
    });

    if (computedStatus !== "DRAFT") {
      order.designApproval = "PENDING";
      await order.save();
    }

    const action = computedStatus === "DRAFT" ? "REVISION_CREATE" : "REVISION_SUBMIT";
    await appendRevisionAuditLog(
      orderId,
      designId,
      action,
      user.id,
      user.email,
      user.role,
      `Revision #${revisionNumber} created with status ${computedStatus}. Reason: ${revisionReason || "None"}. Change summary: ${changeSummary || "None"}. IP: ${getClientIp(req)}`
    );

    await sendRevisionNotification(
      computedStatus === "DRAFT" ? "REVISION_CREATED" : "REVISION_SUBMITTED",
      computedStatus === "DRAFT" ? "Draft Revision Created" : "Revision Submitted",
      `Revision #${revisionNumber} for order ${orderId} and design ${designId} has been ${computedStatus.toLowerCase()}.`,
      orderId
    );

    return res.status(201).json({ success: true, data: revision });
  } catch (error: any) {
    console.error("[Revision] createRevision error:", error);
    return res.status(500).json({ success: false, error: "Failed to create design revision" });
  }
};

export const getRevisions = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const user = req.user!;

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER", "CUSTOMER", "DESIGNER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view revisions" });
    }

    if (!orderId || !designId) {
      return res.status(400).json({ success: false, error: "orderId and designId are required" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = order.customerId || order.customerContact || order.customerEmail;
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    const revisions = await DesignRevision.find({ orderId, designId }).sort({ revisionNumber: -1 }).lean();
    return res.json({ success: true, data: revisions });
  } catch (error: any) {
    console.error("[Revision] getRevisions error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch revision history" });
  }
};

export const getRevisionById = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId, revisionId } = req.params;
    const user = req.user!;

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER", "CUSTOMER", "DESIGNER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view revisions" });
    }

    const revision = await DesignRevision.findOne({ _id: revisionId, orderId, designId }).lean();
    if (!revision) {
      return res.status(404).json({ success: false, error: "Revision not found" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = order.customerId || order.customerContact || order.customerEmail;
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    return res.json({ success: true, data: revision });
  } catch (error: any) {
    console.error("[Revision] getRevisionById error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch revision details" });
  }
};

export const getLatestRevision = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const user = req.user!;

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER", "CUSTOMER", "DESIGNER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view revisions" });
    }

    const latest = await DesignRevision.findOne({ orderId, designId }).sort({ revisionNumber: -1 }).lean();
    if (!latest) {
      return res.status(404).json({ success: false, error: "No revisions found" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = order.customerId || order.customerContact || order.customerEmail;
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    return res.json({ success: true, data: latest });
  } catch (error: any) {
    console.error("[Revision] getLatestRevision error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch latest revision" });
  }
};
