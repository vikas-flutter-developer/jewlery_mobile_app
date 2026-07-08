import express from "express";
import { authMiddleware } from "../../lib/authUtils.js";
import {
  getSecurityOverview,
  getSecuritySettings,
  updateSecuritySettings,
  listSecurityEventsEndpoint,
} from "../controllers/security/securityController.js";

const router = express.Router();

router.get("/", authMiddleware, getSecurityOverview);
router.get("/settings", authMiddleware, getSecuritySettings);
router.put("/settings", authMiddleware, updateSecuritySettings);
router.get("/events", authMiddleware, listSecurityEventsEndpoint);

export default router;
