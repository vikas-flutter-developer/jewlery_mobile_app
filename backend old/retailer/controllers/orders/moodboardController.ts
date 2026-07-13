import path from "path";
import { randomUUID } from "crypto";
import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { DesignMoodboard, DesignMoodboardAuditLog, Order, Notification } from "../../models/index.js";
import { getClientIp } from "../../../lib/authUtils.js";

// ─── RBAC definitions ────────────────────────────────────────────────────────
const FULL_ACCESS_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];
const UPLOAD_EDIT_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER"];
const VIEW_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER", "CUSTOMER"];

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_IMAGES_PER_MOODBOARD = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateMoodboardId = () =>
  `MB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

const generateLogId = () =>
  `MBL-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

const generateNotificationId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

const canView = (role: string) => VIEW_ROLES.includes(role);
const canUploadOrEdit = (role: string) => UPLOAD_EDIT_ROLES.includes(role);
const canDelete = (role: string) => FULL_ACCESS_ROLES.includes(role);

async function appendAuditLog(
  moodboardId: string,
  orderId: string,
  action: "UPLOAD" | "UPDATE" | "DELETE" | "DOWNLOAD",
  userId: string,
  userEmail: string | undefined,
  userRole: string | undefined,
  details: string
) {
  try {
    await DesignMoodboardAuditLog.create({
      logId: generateLogId(),
      moodboardId,
      orderId,
      action,
      userId,
      userEmail: userEmail || "",
      userRole: userRole || "",
      details,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[MoodboardAuditLog] Failed to write audit log:", err);
  }
}

async function sendMoodboardNotification(
  eventType: "UPLOAD" | "UPDATE" | "DELETE",
  orderId: string,
  moodboardTitle: string,
  actorName: string
) {
  try {
    const actionLabel = eventType === "UPLOAD" ? "uploaded" : eventType === "UPDATE" ? "updated" : "deleted";
    const title = `Moodboard ${actionLabel}: ${moodboardTitle}`;
    const message = `${actorName} ${actionLabel} a design moodboard for order #${orderId}.`;

    await Notification.create({
      notificationId: generateNotificationId("MOODBOARD"),
      type: `MOODBOARD_${eventType}`,
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
    console.error("[MoodboardNotification] Failed to create notification:", err);
  }
}

// ─── Controller Handlers ──────────────────────────────────────────────────────

/**
 * POST /api/orders/:orderId/moodboard
 * Create a new moodboard for an order (with image uploads already done via /upload).
 */
export const createMoodboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId } = req.params;
    const { title, description, tags, images } = req.body;
    const user = req.user!;

    if (!canUploadOrEdit(user.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to upload moodboards" });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required" });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: "Moodboard title is required" });
    }

    // Verify order exists
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Customer RBAC: may only upload to their own orders
    if (user.role === "CUSTOMER") {
      const orderCustomerId = (order as any).customerId || (order as any).customerContact;
      if (orderCustomerId && orderCustomerId !== user.id && orderCustomerId !== user.email) {
        return res.status(403).json({ success: false, error: "Access denied: you can only upload moodboards to your own orders" });
      }
    }

    // Validate and normalize images array
    const imageList: { url: string; filename: string; uploadedBy: string; uploadedAt: Date }[] = [];
    if (Array.isArray(images) && images.length > 0) {
      if (images.length > MAX_IMAGES_PER_MOODBOARD) {
        return res.status(400).json({ success: false, error: `Maximum ${MAX_IMAGES_PER_MOODBOARD} images allowed per moodboard` });
      }
      for (const img of images) {
        const urlStr = typeof img === "string" ? img : (img.url || "");
        const filename = typeof img === "object" ? (img.filename || path.basename(urlStr)) : path.basename(urlStr);
        const ext = path.extname(filename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return res.status(400).json({
            success: false,
            error: `Unsupported file type '${ext}'. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`,
          });
        }
        imageList.push({
          url: urlStr,
          filename,
          uploadedBy: user.id,
          uploadedAt: new Date(),
        });
      }
    }

    const sanitizedTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];

    const moodboard = await DesignMoodboard.create({
      moodboardId: generateMoodboardId(),
      orderId,
      customerId: (order as any).customerId || "",
      uploadedBy: user.id,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      images: imageList,
      tags: sanitizedTags,
      status: "ACTIVE",
    });

    await appendAuditLog(
      moodboard.moodboardId,
      orderId,
      "UPLOAD",
      user.id,
      user.email,
      user.role,
      `Moodboard "${moodboard.title}" created with ${imageList.length} image(s). IP: ${getClientIp(req)}`
    );

    await sendMoodboardNotification("UPLOAD", orderId, moodboard.title, user.email || user.id);

    return res.status(201).json({ success: true, data: moodboard });
  } catch (error: any) {
    console.error("[Moodboard] createMoodboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to create moodboard" });
  }
};

/**
 * GET /api/orders/:orderId/moodboard
 * Retrieve all moodboards for an order.
 */
export const getMoodboards = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId } = req.params;
    const user = req.user!;

    if (!canView(user.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to view moodboards" });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required" });
    }

    const filter: any = { orderId, status: "ACTIVE" };
    // Customer can only see their own moodboards
    if (user.role === "CUSTOMER") {
      filter.customerId = user.id;
    }

    const moodboards = await DesignMoodboard.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({ success: true, data: moodboards });
  } catch (error: any) {
    console.error("[Moodboard] getMoodboards error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch moodboards" });
  }
};

/**
 * PUT /api/orders/:orderId/moodboard/:moodboardId
 * Update a moodboard (title, description, tags, add/remove images).
 */
export const updateMoodboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, moodboardId } = req.params;
    const user = req.user!;

    if (!canUploadOrEdit(user.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to edit moodboards" });
    }

    const moodboard = await DesignMoodboard.findOne({ moodboardId, orderId });
    if (!moodboard) {
      return res.status(404).json({ success: false, error: "Moodboard not found" });
    }

    // Customer can only edit their own moodboards
    if (user.role === "CUSTOMER" && moodboard.uploadedBy !== user.id) {
      return res.status(403).json({ success: false, error: "Access denied: you can only edit your own moodboards" });
    }

    const { title, description, tags, images, addImages, removeImageUrls } = req.body;

    if (title !== undefined) moodboard.title = String(title).trim();
    if (description !== undefined) moodboard.description = String(description).trim();
    if (tags !== undefined) moodboard.tags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];

    // Full image array replacement
    if (Array.isArray(images)) {
      if (images.length > MAX_IMAGES_PER_MOODBOARD) {
        return res.status(400).json({ success: false, error: `Maximum ${MAX_IMAGES_PER_MOODBOARD} images allowed per moodboard` });
      }
      moodboard.images = images.map((img: any) => {
        const urlStr = typeof img === "string" ? img : (img.url || "");
        const filename = typeof img === "object" ? (img.filename || path.basename(urlStr)) : path.basename(urlStr);
        return { url: urlStr, filename, uploadedBy: img.uploadedBy || user.id, uploadedAt: img.uploadedAt || new Date() };
      });
    }

    // Incremental: add new images
    if (Array.isArray(addImages) && addImages.length > 0) {
      const currentCount = moodboard.images.length;
      if (currentCount + addImages.length > MAX_IMAGES_PER_MOODBOARD) {
        return res.status(400).json({ success: false, error: `Adding ${addImages.length} images would exceed the ${MAX_IMAGES_PER_MOODBOARD} image limit` });
      }
      for (const img of addImages) {
        const urlStr = typeof img === "string" ? img : (img.url || "");
        const filename = typeof img === "object" ? (img.filename || path.basename(urlStr)) : path.basename(urlStr);
        const ext = path.extname(filename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return res.status(400).json({ success: false, error: `Unsupported file type '${ext}'. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` });
        }
        moodboard.images.push({ url: urlStr, filename, uploadedBy: user.id, uploadedAt: new Date() });
      }
    }

    // Incremental: remove images by URL
    if (Array.isArray(removeImageUrls) && removeImageUrls.length > 0) {
      const removeSet = new Set(removeImageUrls);
      moodboard.images = moodboard.images.filter((img: any) => !removeSet.has(img.url));
    }

    await moodboard.save();

    await appendAuditLog(
      moodboard.moodboardId,
      orderId,
      "UPDATE",
      user.id,
      user.email,
      user.role,
      `Moodboard "${moodboard.title}" updated. Images: ${moodboard.images.length}. IP: ${getClientIp(req)}`
    );

    await sendMoodboardNotification("UPDATE", orderId, moodboard.title, user.email || user.id);

    return res.json({ success: true, data: moodboard });
  } catch (error: any) {
    console.error("[Moodboard] updateMoodboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to update moodboard" });
  }
};

/**
 * DELETE /api/orders/:orderId/moodboard/:moodboardId
 * Archive (soft-delete) a moodboard.
 */
export const deleteMoodboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database not available" });
    }

    const { orderId, moodboardId } = req.params;
    const user = req.user!;

    if (!canDelete(user.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to delete moodboards" });
    }

    const moodboard = await DesignMoodboard.findOne({ moodboardId, orderId });
    if (!moodboard) {
      return res.status(404).json({ success: false, error: "Moodboard not found" });
    }

    moodboard.status = "ARCHIVED";
    await moodboard.save();

    await appendAuditLog(
      moodboard.moodboardId,
      orderId,
      "DELETE",
      user.id,
      user.email,
      user.role,
      `Moodboard "${moodboard.title}" archived. IP: ${getClientIp(req)}`
    );

    await sendMoodboardNotification("DELETE", orderId, moodboard.title, user.email || user.id);

    return res.json({ success: true, message: "Moodboard archived successfully" });
  } catch (error: any) {
    console.error("[Moodboard] deleteMoodboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete moodboard" });
  }
};

/**
 * POST /api/orders/:orderId/moodboard/:moodboardId/download-log
 * Record an image download audit event.
 */
export const logImageDownload = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, moodboardId } = req.params;
    const { imageUrl } = req.body;
    const user = req.user!;

    await appendAuditLog(
      moodboardId,
      orderId,
      "DOWNLOAD",
      user.id,
      user.email,
      user.role,
      `Image downloaded: ${imageUrl || "N/A"}. IP: ${getClientIp(req)}`
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Moodboard] logImageDownload error:", error);
    return res.status(500).json({ success: false, error: "Failed to log image download" });
  }
};
