import { Router } from "express";
import { authMiddleware } from "../../lib/authUtils.js";
import {
  createBisLicence,
  updateBisLicence,
  getBisLicences,
  getBisLicenceById,
  activateBisLicence,
  suspendBisLicence,
  getBisLicencesReport,
} from "../../retailer/controllers/settings/bisLicenceController.js";

const router = Router();

router.post("/", authMiddleware, createBisLicence);
router.put("/:id", authMiddleware, updateBisLicence);
router.get("/", authMiddleware, getBisLicences);
router.get("/report", authMiddleware, getBisLicencesReport);
router.get("/:id", authMiddleware, getBisLicenceById);
router.put("/:id/activate", authMiddleware, activateBisLicence);
router.put("/:id/suspend", authMiddleware, suspendBisLicence);

export default router;
