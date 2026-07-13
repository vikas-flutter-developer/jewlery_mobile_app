import express from "express";
import { 
  getBranches, 
  createBranch, 
  updateBranch,
  getConsolidatedDashboard,
  getPLComparison,
  getGSTFiling
} from "../controllers/branches/branchController.js";
import { 
  getBranchTransfers,
  createBranchTransfer, 
  approveBranchTransfer,
  rejectBranchTransfer,
  receiveBranchTransfer 
} from "../controllers/branches/branchTransfersController.js";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

// Consolidated Report endpoints (Register before parametric routes to avoid collisions)
router.get("/reports/consolidated", getConsolidatedDashboard);
router.get("/reports/pl-comparison", getPLComparison);
router.get("/reports/gst-filing", getGSTFiling);

// Branch Registry
router.get("/", getBranches);
router.post("/", authMiddleware, roleMiddleware(["ADMIN", "RETAILER"]), createBranch);
router.put("/:id", authMiddleware, roleMiddleware(["ADMIN", "RETAILER"]), updateBranch);

// Inter-Branch Stock Transfer workflow
router.get("/transfers", getBranchTransfers);
router.post("/transfers", createBranchTransfer);
router.put("/transfers/:transferId/approve", approveBranchTransfer);
router.put("/transfers/:transferId/reject", rejectBranchTransfer);
router.put("/transfers/:transferId/receive", receiveBranchTransfer);

export default router;



