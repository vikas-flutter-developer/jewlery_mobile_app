import { Response } from "express";
import { randomUUID } from "crypto";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { DesignApproval, DesignApprovalAuditLog, Order, Notification } from "../../models/index.js";
import { getClientIp } from "../../../lib/authUtils.js";

// Helper to generate IDs
const generateLogId = () => `DAL-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
const generateNotificationId = () => `NOTIF-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

// Helper to create notifications
async function sendNotification(
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
      category: "Design",
      severity: "INFO",
      channels: ["IN_APP"],
      relatedEntityId: orderId,
      reference: orderId,
      sendAt: new Date(),
      status: "PENDING",
    });
  } catch (err) {
    console.error("[Notification] Failed to create design notification:", err);
  }
}

// Helper to append audit logs
async function appendAuditLog(
  orderId: string,
  designId: string,
  action: "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  userId: string,
  userEmail: string | undefined,
  userRole: string | undefined,
  details: string
) {
  try {
    await DesignApprovalAuditLog.create({
      logId: generateLogId(),
      orderId,
      designId,
      action,
      userId,
      userEmail: userEmail || "",
      userRole: userRole || "",
      details,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write design approval audit:", err);
  }
}

/**
 * POST /api/orders/:orderId/designs/:designId/submit
 */
export const submitDesign = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const { notes } = req.body;
    const user = req.user!;

    // RBAC: Sales Staff, Admin, Super Admin, Retailer, Store Manager
    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to submit designs" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Determine current version count for this design/order
    const existingApprovals = await DesignApproval.find({ orderId, designId }).sort({ version: -1 }).lean();
    const nextVersion = existingApprovals.length > 0 ? existingApprovals[0].version + 1 : 1;

    // Check if there is already an active approved or pending design approval for this designId
    if (existingApprovals.some((app: any) => app.approvalStatus === "APPROVED")) {
      return res.status(400).json({ success: false, error: "Design has already been approved" });
    }

    const approval = await DesignApproval.create({
      orderId,
      designId,
      customerId: order.customerId || order.customerEmail || "",
      submittedBy: user.id,
      approvalStatus: "PENDING",
      version: nextVersion,
      notes: notes || "",
    });

    // Update order status/designApproval
    order.designApproval = "PENDING";
    await order.save();

    await appendAuditLog(
      orderId,
      designId,
      "SUBMIT",
      user.id,
      user.email,
      user.role,
      `Design version ${nextVersion} submitted. Notes: ${notes || "None"}. IP: ${getClientIp(req)}`
    );

    await sendNotification(
      "DESIGN_SUBMITTED",
      "Design Submitted for Review",
      `A new design version ${nextVersion} (ID: ${designId}) has been submitted for order #${orderId}.`,
      orderId
    );

    return res.status(201).json({ success: true, data: approval });
  } catch (error: any) {
    console.error("[DesignApproval] submitDesign error:", error);
    return res.status(500).json({ success: false, error: "Failed to submit design" });
  }
};

/**
 * POST /api/orders/:orderId/designs/:designId/approve
 */
export const approveDesign = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const { notes } = req.body;
    const user = req.user!;

    // RBAC: Customer, Admin, Super Admin, Retailer, Store Manager
    const allowedRoles = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to approve designs" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }


    const latestApproval = await DesignApproval.findOne({ orderId, designId }).sort({ version: -1 });
    if (!latestApproval) {
      return res.status(400).json({ success: false, error: "Design must be submitted first (no draft approval allowed)" });
    }

    if (latestApproval.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, error: `Cannot approve design: current status is ${latestApproval.approvalStatus}` });
    }

    latestApproval.approvalStatus = "APPROVED";
    latestApproval.approvalDate = new Date();
    latestApproval.notes = notes || latestApproval.notes;
    await latestApproval.save();

    // Update order status/designApproval
    order.designApproval = "APPROVED";
    await order.save();

    await appendAuditLog(
      orderId,
      designId,
      "APPROVE",
      user.id,
      user.email,
      user.role,
      `Design approved by ${user.role}. Notes: ${notes || "None"}. IP: ${getClientIp(req)}`
    );

    await sendNotification(
      "DESIGN_APPROVED",
      "Design Approved",
      `The design (ID: ${designId}) has been approved for order #${orderId}. Ready for production.`,
      orderId
    );

    return res.json({ success: true, data: latestApproval });
  } catch (error: any) {
    console.error("[DesignApproval] approveDesign error:", error);
    return res.status(500).json({ success: false, error: "Failed to approve design" });
  }
};

/**
 * POST /api/orders/:orderId/designs/:designId/reject
 */
export const rejectDesign = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const { rejectionReason, notes } = req.body;
    const user = req.user!;

    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({ success: false, error: "Rejection reason is required" });
    }

    // RBAC: Customer, Admin, Super Admin, Retailer, Store Manager
    const allowedRoles = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to reject designs" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const latestApproval = await DesignApproval.findOne({ orderId, designId }).sort({ version: -1 });
    if (!latestApproval) {
      return res.status(400).json({ success: false, error: "Design must be submitted first" });
    }

    if (latestApproval.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, error: `Cannot reject design: current status is ${latestApproval.approvalStatus}` });
    }

    latestApproval.approvalStatus = "REJECTED";
    latestApproval.rejectionReason = rejectionReason;
    latestApproval.notes = notes || latestApproval.notes;
    latestApproval.approvalDate = new Date();
    await latestApproval.save();

    order.designApproval = "REJECTED";
    await order.save();

    await appendAuditLog(
      orderId,
      designId,
      "REJECT",
      user.id,
      user.email,
      user.role,
      `Design rejected. Reason: ${rejectionReason}. IP: ${getClientIp(req)}`
    );

    await sendNotification(
      "DESIGN_REJECTED",
      "Design Rejected",
      `The design (ID: ${designId}) has been rejected for order #${orderId}. Reason: ${rejectionReason}`,
      orderId
    );

    return res.json({ success: true, data: latestApproval });
  } catch (error: any) {
    console.error("[DesignApproval] rejectDesign error:", error);
    return res.status(500).json({ success: false, error: "Failed to reject design" });
  }
};

/**
 * POST /api/orders/:orderId/designs/:designId/request-changes
 */
export const requestChanges = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, designId } = req.params;
    const { changeRequest, notes } = req.body;
    const user = req.user!;

    if (!changeRequest || !String(changeRequest).trim()) {
      return res.status(400).json({ success: false, error: "Change request details are required" });
    }

    // RBAC: Customer, Admin, Super Admin, Retailer, Store Manager
    const allowedRoles = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to request changes" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const latestApproval = await DesignApproval.findOne({ orderId, designId }).sort({ version: -1 });
    if (!latestApproval) {
      return res.status(400).json({ success: false, error: "Design must be submitted first" });
    }

    if (latestApproval.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, error: `Cannot request changes: current status is ${latestApproval.approvalStatus}` });
    }

    latestApproval.approvalStatus = "CHANGES_REQUESTED";
    latestApproval.changeRequest = changeRequest;
    latestApproval.notes = notes || latestApproval.notes;
    latestApproval.approvalDate = new Date();
    await latestApproval.save();

    order.designApproval = "PENDING"; // stays pending overall design process but updates logs
    await order.save();

    await appendAuditLog(
      orderId,
      designId,
      "REQUEST_CHANGES",
      user.id,
      user.email,
      user.role,
      `Changes requested. Request: ${changeRequest}. IP: ${getClientIp(req)}`
    );

    await sendNotification(
      "DESIGN_CHANGES_REQUESTED",
      "Design Revisions Requested",
      `Revisions requested for design (ID: ${designId}) on order #${orderId}. Request: ${changeRequest}`,
      orderId
    );

    return res.json({ success: true, data: latestApproval });
  } catch (error: any) {
    console.error("[DesignApproval] requestChanges error:", error);
    return res.status(500).json({ success: false, error: "Failed to request changes" });
  }
};

/**
 * GET /api/orders/:orderId/design-approvals
 */
export const getApprovals = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId } = req.params;
    const user = req.user!;

    // RBAC: Customer, Admin, Super Admin, Retailer, Store Manager, Sales Staff, Manufacturer
    const allowedRoles = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view approvals" });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (user.role === "CUSTOMER") {
      const orderCustomer = order.customerId || order.customerContact;
      if (orderCustomer && orderCustomer !== user.id && orderCustomer !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: this is not your order" });
      }
    }

    const history = await DesignApproval.find({ orderId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: history });
  } catch (error: any) {
    console.error("[DesignApproval] getApprovals error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch approval history" });
  }
};

/**
 * GET /api/orders/:orderId/design-approvals/latest
 */
export const getLatestApproval = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId } = req.params;
    const user = req.user!;

    const allowedRoles = ["CUSTOMER", "ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Unauthorized to view approvals" });
    }

    const latest = await DesignApproval.findOne({ orderId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: latest });
  } catch (error: any) {
    console.error("[DesignApproval] getLatestApproval error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch latest approval" });
  }
};
