import express from "express";
import { authMiddleware } from "../../lib/authUtils.js";
import {
  getRepairJobs,
  createRepairJob,
  updateRepairJob
} from "../controllers/inventory/repairController.js";

const router = express.Router();

router.get("/", authMiddleware, getRepairJobs);
router.post("/", authMiddleware, createRepairJob);
router.put("/:id", authMiddleware, updateRepairJob);

export default router;



