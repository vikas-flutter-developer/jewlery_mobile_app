import express from "express";
import {
  linkTag,
  bulkAudit,
  antiTheftGate,
  getLifecycle,
  confirmTransfer,
  getAllTags
} from "../controllers/rfid/rfidController.js";

const router = express.Router();

// Assign tags & fetch lists
router.get("/", getAllTags);
router.post("/link", linkTag);

// Reconciliations & sweeps
router.post("/reconcile", bulkAudit);
router.post("/transfer-confirm", confirmTransfer);

// Security gates & lifecycle tracking
router.post("/exit-gate", antiTheftGate);
router.get("/lifecycle/:epc", getLifecycle);

export default router;


