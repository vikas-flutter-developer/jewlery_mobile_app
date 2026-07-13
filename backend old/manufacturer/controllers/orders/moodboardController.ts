import path from "path";
import { randomUUID } from "crypto";
import { Response } from "express";
import { AuthRequest, getClientIp } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";
import {
  ManufacturerDesignMoodboard,
  ManufacturerDesignMoodboardAuditLog,
  ManufacturerOrder,
} from "../../models/index.js";

// ─── RBAC ────────────────────────────────────────────────────────────────────
const UPLOAD_EDIT_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER"];
const VIEW_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER", "SALES_STAFF", "SALES", "MANUFACTURER", "CUSTOMER"];
const FULL_ACCESS_ROLES = ["ADMIN", "SUPER_ADMIN", "RETAILER", "STORE_MANAGER"];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_IMAGES_PER_MOODBOARD = 20;

const canView = (role: string) => VIEW_ROLES.includes(role);
const canUploadOrEdit = (role: string) => UPLOAD_EDIT_ROLES.includes(role);
const canDelete = (role: string) => FULL_ACCESS_ROLES.includes(role);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateMoodboardId = () =>
  `MB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

const generateLogId = () =>
  `MBL-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;

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
    await ManufacturerDesignMoodboardAuditLog.create({
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
    console.error("[ManufacturerMoodboardAuditLog] Failed to write audit log:", err);
  }
}

// ─── Controller Handlers ──────────────────────────────────────────────────────

/**
 * POST /api/manufacturer/orders/:orderId/moodboard
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

    // Verify order exists in manufacturer DB
    const order = await ManufacturerOrder.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    // Validate images
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
            error: `Unsupported file type '${ext}'. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
          });
        }
        imageList.push({ url: urlStr, filename, uploadedBy: user.id, uploadedAt: new Date() });
      }
    }

    const sanitizedTags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];

    const moodboard = await ManufacturerDesignMoodboard.create({
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

    return res.status(201).json({ success: true, data: moodboard });
  } catch (error: any) {
    console.error("[ManufacturerMoodboard] createMoodboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to create moodboard" });
  }
};

/**
 * GET /api/manufacturer/orders/:orderId/moodboard
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

    const moodboards = await ManufacturerDesignMoodboard.find({ orderId, status: "ACTIVE" })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: moodboards });
  } catch (error: any) {
    console.error("[ManufacturerMoodboard] getMoodboards error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch moodboards" });
  }
};

/**
 * PUT /api/manufacturer/orders/:orderId/moodboard/:moodboardId
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

    const moodboard = await ManufacturerDesignMoodboard.findOne({ moodboardId, orderId });
    if (!moodboard) {
      return res.status(404).json({ success: false, error: "Moodboard not found" });
    }

    const { title, description, tags, images, addImages, removeImageUrls } = req.body;

    if (title !== undefined) moodboard.title = String(title).trim();
    if (description !== undefined) moodboard.description = String(description).trim();
    if (tags !== undefined) moodboard.tags = Array.isArray(tags) ? tags.map((t: any) => String(t).trim()).filter(Boolean) : [];

    if (Array.isArray(images)) {
      if (images.length > MAX_IMAGES_PER_MOODBOARD) {
        return res.status(400).json({ success: false, error: `Maximum ${MAX_IMAGES_PER_MOODBOARD} images allowed` });
      }
      moodboard.images = images.map((img: any) => {
        const urlStr = typeof img === "string" ? img : (img.url || "");
        const filename = typeof img === "object" ? (img.filename || path.basename(urlStr)) : path.basename(urlStr);
        return { url: urlStr, filename, uploadedBy: img.uploadedBy || user.id, uploadedAt: img.uploadedAt || new Date() };
      });
    }

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

    return res.json({ success: true, data: moodboard });
  } catch (error: any) {
    console.error("[ManufacturerMoodboard] updateMoodboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to update moodboard" });
  }
};

/**
 * DELETE /api/manufacturer/orders/:orderId/moodboard/:moodboardId
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

    const moodboard = await ManufacturerDesignMoodboard.findOne({ moodboardId, orderId });
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

    return res.json({ success: true, message: "Moodboard archived successfully" });
  } catch (error: any) {
    console.error("[ManufacturerMoodboard] deleteMoodboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete moodboard" });
  }
};

/**
 * POST /api/manufacturer/orders/:orderId/moodboard/:moodboardId/download-log
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
    console.error("[ManufacturerMoodboard] logImageDownload error:", error);
    return res.status(500).json({ success: false, error: "Failed to log image download" });
  }
};
