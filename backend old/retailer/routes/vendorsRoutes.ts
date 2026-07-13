import express from "express";
import { getVendors, createVendor, getVendorById, getVendorLedger, updateVendor, deleteVendor } from "../controllers/vendors/vendorsController.js";
import { authMiddleware, roleMiddleware } from "../../lib/authUtils.js";

const router = express.Router();

router.get("/", authMiddleware, getVendors);
router.post("/", authMiddleware, roleMiddleware(["ADMIN", "STORE_MANAGER"]), createVendor);
router.get("/:id/ledger", authMiddleware, getVendorLedger);
router.get("/:id", authMiddleware, getVendorById);
router.put("/:id", authMiddleware, roleMiddleware(["ADMIN", "STORE_MANAGER"]), updateVendor);
router.delete("/:id", authMiddleware, roleMiddleware(["ADMIN", "STORE_MANAGER"]), deleteVendor);

export default router;



