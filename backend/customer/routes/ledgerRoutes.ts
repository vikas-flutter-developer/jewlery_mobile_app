import express from "express";
import {
  getLedgerByPhone,
  getAllLedgerEntries,
  addLedgerEntry,
  getLedgerSummary,
} from "../controllers/ledger/ledgerController.js";

const router = express.Router();

// Get all ledger entries (admin)
router.get("/", getAllLedgerEntries);

// Add a new ledger entry
router.post("/", addLedgerEntry);

// Get summary stats for a customer
router.get("/:phone/summary", getLedgerSummary);

// Get ledger history by customer phone
router.get("/:phone", getLedgerByPhone);

export default router;
