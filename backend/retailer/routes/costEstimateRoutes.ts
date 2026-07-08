import express from "express";
import {
  createCostEstimate,
  getCostEstimates,
  getCostEstimateById,
  getLatestCostEstimate,
  approveCostEstimate,
  declineCostEstimate,
  downloadCostEstimatePdf,
} from "../controllers/orders/costEstimateController.js";
import { authMiddleware } from "../../lib/authUtils.js";

const router = express.Router();
router.post("/:orderId/designs/:designId/cost-estimates", authMiddleware, createCostEstimate);
router.get("/:orderId/designs/:designId/cost-estimates", authMiddleware, getCostEstimates);
router.get("/:orderId/designs/:designId/cost-estimates/latest", authMiddleware, getLatestCostEstimate);
router.get("/:orderId/designs/:designId/cost-estimates/:estimateId", authMiddleware, getCostEstimateById);
router.post("/:orderId/designs/:designId/cost-estimates/:estimateId/approve", authMiddleware, approveCostEstimate);
router.post("/:orderId/designs/:designId/cost-estimates/:estimateId/decline", authMiddleware, declineCostEstimate);
router.get("/:orderId/designs/:designId/cost-estimates/:estimateId/pdf", authMiddleware, downloadCostEstimatePdf);

export default router;
