import express from "express";
import { createOrder, getOrders, updateOrderStatus, deleteOrder, updateOrder } from "../controllers/orders/ordersController.js";
import { createMoodboard, getMoodboards, updateMoodboard, deleteMoodboard, logImageDownload } from "../controllers/orders/moodboardController.js";
import { submitDesign, approveDesign, rejectDesign, requestChanges, getApprovals, getLatestApproval } from "../controllers/orders/approvalController.js";
import { createRevision, getRevisions, getRevisionById, getLatestRevision } from "../controllers/orders/revisionController.js";
import { generateTracking, getOrderTrackingInternal, updateTrackingStatus, revokeTracking } from "../controllers/orders/orderTrackingController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();
router.get("/", getOrders);
router.post("/", createOrder);
router.put("/:id/status", updateOrderStatus);
router.put("/:id", updateOrder);
router.delete("/:id", deleteOrder);

// ─── Order Tracking endpoints ────────────────────────────────────────────────
router.post("/:orderId/generate-tracking", authMiddleware, generateTracking);
router.get("/:orderId/tracking", authMiddleware, getOrderTrackingInternal);
router.put("/:orderId/tracking-status", authMiddleware, updateTrackingStatus);
router.post("/:orderId/revoke-tracking", authMiddleware, revokeTracking);

// ─── Design Moodboard endpoints ───────────────────────────────────────────────

router.post("/:orderId/moodboard", authMiddleware, createMoodboard);
router.get("/:orderId/moodboard", authMiddleware, getMoodboards);
router.put("/:orderId/moodboard/:moodboardId", authMiddleware, updateMoodboard);
router.delete("/:orderId/moodboard/:moodboardId", authMiddleware, deleteMoodboard);
router.post("/:orderId/moodboard/:moodboardId/download-log", authMiddleware, logImageDownload);

// ─── Design Approval endpoints ───────────────────────────────────────────────
router.post("/:orderId/designs/:designId/submit", authMiddleware, submitDesign);
router.post("/:orderId/designs/:designId/approve", authMiddleware, approveDesign);
router.post("/:orderId/designs/:designId/reject", authMiddleware, rejectDesign);
router.post("/:orderId/designs/:designId/request-changes", authMiddleware, requestChanges);
router.get("/:orderId/design-approvals", authMiddleware, getApprovals);
router.get("/:orderId/design-approvals/latest", authMiddleware, getLatestApproval);

// ─── Design Revision endpoints ───────────────────────────────────────────────
router.post("/:orderId/designs/:designId/revisions", authMiddleware, createRevision);
router.get("/:orderId/designs/:designId/revisions", authMiddleware, getRevisions);
router.get("/:orderId/designs/:designId/revisions/:revisionId", authMiddleware, getRevisionById);
router.get("/:orderId/designs/:designId/revisions/latest", authMiddleware, getLatestRevision);

export default router;


