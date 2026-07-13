import express from "express";
import { authMiddleware, roleMiddleware } from "../lib/authUtils.js";
import {
  generateJobCardHandler,
  regenerateJobCardHandler,
  getJobCardHandler,
  getJobCardHistoryHandler,
  getJobCardPdfHandler,
} from "../controllers/jobs/jobCardController.js";

const router = express.Router();

router.get(":jobId/job-card", authMiddleware, getJobCardHandler);
router.get(":jobId/job-card/history", authMiddleware, getJobCardHistoryHandler);
router.get(":jobId/job-card/pdf", authMiddleware, roleMiddleware(["ADMIN", "MANUFACTURER", "PRODUCTION_MANAGER", "RETAILER", "STORE_MANAGER"]), getJobCardPdfHandler);
router.post(":jobId/job-card/regenerate", authMiddleware, roleMiddleware(["ADMIN", "MANUFACTURER", "PRODUCTION_MANAGER"]), regenerateJobCardHandler);
router.post(":jobId/job-card", authMiddleware, roleMiddleware(["ADMIN", "MANUFACTURER", "PRODUCTION_MANAGER"]), generateJobCardHandler);

export default router;
