import { Response } from "express";
import { randomUUID } from "crypto";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { Order, OrderTracking, Notification } from "../../models/index.js";

// Helper to generate a short unique tracking code
const generateTrackingCode = () => {
  return "TRK" + Math.random().toString(36).substring(2, 8).toUpperCase();
};

const generateNotificationId = () => `NOTIF-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

// Mock internal memory database for fallback mode
let mockOrderTrackings: any[] = [];

// Helper to append tracking events to Notifications
async function sendTrackingNotification(
  type: string,
  title: string,
  message: string,
  orderId: string,
  emails: string[] = []
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: generateNotificationId(),
        type,
        title,
        message,
        category: "OrderTracking",
        severity: "INFO",
        channels: ["IN_APP", "EMAIL"],
        recipientEmails: emails,
        relatedEntityId: orderId,
        reference: orderId,
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[Notification] Failed to create tracking notification:", err);
  }
}

// Helper to write to generic/global audit logs or trigger custom audit integrations
async function logAudit(action: string, orderId: string, details: string, userEmail: string = "System") {
  // Integrate directly with existing audit logs (DesignMoodboardAuditLog / DesignApprovalAuditLog patterns or general console tracking if global table is not shared)
  console.log(`[Audit] Action: ${action} | OrderId: ${orderId} | Details: ${details} | User: ${userEmail}`);
}

/**
 * POST /api/orders/:orderId/generate-tracking
 */
export const generateTracking = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { expiresDays } = req.body;
    const user = req.user!;

    // RBAC: Admin, Super Admin, Retailer, Store Manager, Sales
    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions to generate tracking links" });
    }

    let order: any;
    if (isDbConnected()) {
      order = await Order.findById(orderId).lean();
    } else {
      order = { _id: orderId, customerEmail: "mock@example.com", status: "PENDING" };
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const trackingCode = generateTrackingCode();
    const publicToken = randomUUID();
    // Expiry default is 30 days
    const days = expiresDays ? Number(expiresDays) : 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const shareableUrl = `/track/${publicToken}`;

    const trackingData = {
      orderId,
      trackingCode,
      publicToken,
      shareableUrl,
      trackingStatus: "ORDER_PLACED",
      statusTimeline: [{
        status: "ORDER_PLACED",
        updatedAt: new Date(),
        updatedBy: user.email
      }],
      lastUpdatedAt: new Date(),
      expiresAt,
      isActive: true
    };

    let trackingRecord: any;
    if (isDbConnected()) {
      // Deactivate old active tracking links first
      await OrderTracking.updateMany({ orderId }, { isActive: false });
      trackingRecord = new OrderTracking(trackingData);
      await trackingRecord.save();
    } else {
      mockOrderTrackings = mockOrderTrackings.map(t => t.orderId === orderId ? { ...t, isActive: false } : t);
      trackingRecord = { ...trackingData, _id: `mock_track_${Date.now()}` };
      mockOrderTrackings.push(trackingRecord);
    }

    await logAudit("Tracking Link Generated", orderId, `Code: ${trackingCode}`, user.email);

    // Send notifications
    const emails = [];
    if (order.customerEmail) emails.push(order.customerEmail);
    await sendTrackingNotification(
      "TRACKING_LINK_GENERATED",
      "Order Tracking Link Ready",
      `Your tracking link is active: ${shareableUrl}. Code: ${trackingCode}`,
      orderId,
      emails
    );

    return res.status(201).json({ success: true, data: trackingRecord });
  } catch (error: any) {
    console.error("Failed to generate tracking", error);
    return res.status(500).json({ error: error.message || "Failed to generate tracking" });
  }
};

/**
 * GET /api/orders/:orderId/tracking
 */
export const getOrderTrackingInternal = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    let trackingRecord: any;
    if (isDbConnected()) {
      trackingRecord = await OrderTracking.findOne({ orderId, isActive: true }).lean();
    } else {
      trackingRecord = mockOrderTrackings.find(t => t.orderId === orderId && t.isActive);
    }

    if (!trackingRecord) {
      return res.status(404).json({ error: "Tracking details not found" });
    }

    return res.json({ success: true, data: trackingRecord });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to retrieve tracking info" });
  }
};

/**
 * PUT /api/orders/:orderId/tracking-status
 */
export const updateTrackingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const user = req.user!;

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    let trackingRecord: any;
    if (isDbConnected()) {
      trackingRecord = await OrderTracking.findOne({ orderId, isActive: true });
    } else {
      trackingRecord = mockOrderTrackings.find(t => t.orderId === orderId && t.isActive);
    }

    if (!trackingRecord) {
      return res.status(404).json({ error: "Active tracking link not found" });
    }

    // Update status and timeline
    trackingRecord.trackingStatus = status;
    trackingRecord.lastUpdatedAt = new Date();
    trackingRecord.statusTimeline.push({
      status,
      updatedAt: new Date(),
      updatedBy: user.email
    });

    if (isDbConnected()) {
      await trackingRecord.save();
    } else {
      mockOrderTrackings = mockOrderTrackings.map(t => t.orderId === orderId && t.isActive ? trackingRecord : t);
    }

    await logAudit("Tracking Status Updated", orderId, `New Status: ${status}`, user.email);

    // Notify Customer and Staff
    let order: any;
    if (isDbConnected()) {
      order = await Order.findById(orderId).lean();
    } else {
      order = { _id: orderId, customerEmail: "mock@example.com" };
    }

    const emails = [];
    if (order && order.customerEmail) emails.push(order.customerEmail);

    await sendTrackingNotification(
      "TRACKING_STATUS_UPDATED",
      "Order Status Updated",
      `Order status updated to: ${status}`,
      orderId,
      emails
    );

    if (status === "DELIVERED") {
      await sendTrackingNotification(
        "ORDER_DELIVERED",
        "Order Delivered Successfully",
        `Your order has been marked as DELIVERED!`,
        orderId,
        emails
      );
    }

    return res.json({ success: true, data: trackingRecord });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update tracking status" });
  }
};

/**
 * GET /api/public/order-tracking/:token
 */
export const getPublicOrderTracking = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    let trackingRecord: any;
    if (isDbConnected()) {
      trackingRecord = await OrderTracking.findOne({ publicToken: token }).lean();
    } else {
      trackingRecord = mockOrderTrackings.find(t => t.publicToken === token);
    }

    if (!trackingRecord) {
      return res.status(404).json({ error: "Tracking link is invalid" });
    }

    if (!trackingRecord.isActive) {
      return res.status(403).json({ error: "This tracking link is inactive" });
    }

    if (new Date(trackingRecord.expiresAt) < new Date()) {
      return res.status(403).json({ error: "This tracking link has expired" });
    }

    // Retrieve order and sanitize details
    let order: any;
    if (isDbConnected()) {
      order = await Order.findById(trackingRecord.orderId).lean();
    } else {
      order = {
        _id: trackingRecord.orderId,
        customerName: "John Customer",
        createdAt: new Date(),
        neededDate: "2026-08-01",
        status: trackingRecord.trackingStatus,
        specifications: "22K Ring with custom design",
        uploadedImages: []
      };
    }

    if (!order) {
      return res.status(404).json({ error: "Order details not found" });
    }

    // Calculate progress percentage
    const stages = [
      "ORDER_PLACED",
      "DESIGN_APPROVED",
      "IN_PRODUCTION",
      "QUALITY_CHECK",
      "READY_FOR_DELIVERY",
      "DELIVERED"
    ];
    const currentIndex = stages.indexOf(trackingRecord.trackingStatus);
    const progressPercentage = currentIndex === -1 ? 0 : Math.round(((currentIndex + 1) / stages.length) * 100);

    // Sanitize - absolutely do NOT expose internal costs, profits, customer personal ID, karikar ID or supplier details
    const sanitizedOrder = {
      orderNumber: order._id,
      orderDate: order.createdAt,
      expectedDeliveryDate: order.neededDate || order.deadline,
      productDetails: order.specifications || order.customDescription || "Jewellery Order",
      status: trackingRecord.trackingStatus,
      progressPercentage,
      statusTimeline: trackingRecord.statusTimeline,
      uploadedImages: order.uploadedImages || []
    };

    return res.json({ success: true, data: sanitizedOrder });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to query public tracking details" });
  }
};

/**
 * POST /api/orders/:orderId/revoke-tracking
 */
export const revokeTracking = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const user = req.user!;

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions to revoke links" });
    }

    if (isDbConnected()) {
      await OrderTracking.updateMany({ orderId }, { isActive: false });
    } else {
      mockOrderTrackings = mockOrderTrackings.map(t => t.orderId === orderId ? { ...t, isActive: false } : t);
    }

    await logAudit("Tracking Link Revoked", orderId, "Link revoked manually", user.email);

    return res.json({ success: true, message: "Tracking link revoked successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to revoke link" });
  }
};
