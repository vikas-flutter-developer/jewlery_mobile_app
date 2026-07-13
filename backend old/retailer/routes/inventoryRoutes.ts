import express from "express";
import path from "path";
import multer from "multer";
import { 
  createInventory, 
  getInventory, 
  reconcileInventory, 
  updateInventory,
  getConsignmentStock,
  createConsignmentStock,
  updateConsignmentStock
} from "../controllers/inventory/inventoryController.js";
import {
  postBisCertificate,
  getInventoryCertificates,
  prepareBisUploadFolder,
} from "../controllers/compliance/bisCertificateController.js";
import {
  uploadInventoryPhotos,
  getInventoryPhotos,
  deleteInventoryPhoto,
  setPrimaryInventoryPhoto,
} from "../controllers/inventory/inventoryPhotoController.js";
import {
  bulkImportInventory,
  getImportHistory,
  getImportHistoryById,
} from "../controllers/inventory/bulkImportController.js";
import { catalogueAuth } from "../middleware/catalogueAuth.js";
import {
  inventoryPhotoUpload,
  bulkImportUpload,
  handleMulterError,
} from "../middleware/catalogueMulter.js";

const router = express.Router();

const bisUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, prepareBisUploadFolder(req));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".pdf");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/", getInventory);
router.post("/", createInventory);
router.post("/reconcile", reconcileInventory);

// Bulk import & import history (before /:id routes)
router.post(
  "/bulk-import",
  ...catalogueAuth,
  bulkImportUpload.single("file"),
  handleMulterError,
  bulkImportInventory
);
router.get("/import-history", ...catalogueAuth, getImportHistory);
router.get("/import-history/:id", ...catalogueAuth, getImportHistoryById);

// Consignment routes (must be before /:id)
router.get("/consignment", getConsignmentStock);
router.post("/consignment", createConsignmentStock);
router.put("/consignment/:id", updateConsignmentStock);

// SKU photo management
router.post(
  "/:skuId/photo",
  ...catalogueAuth,
  inventoryPhotoUpload.array("photos", 10),
  handleMulterError,
  uploadInventoryPhotos
);
router.get("/:skuId/photos", getInventoryPhotos);
router.delete("/:skuId/photo/:photoId", ...catalogueAuth, deleteInventoryPhoto);
router.put("/:skuId/photo/:photoId/primary", ...catalogueAuth, setPrimaryInventoryPhoto);

router.put("/:id", updateInventory);

// BIS Certificate Management
router.post("/:id/certificates/bis", bisUpload.single("file"), postBisCertificate);
router.get("/:id/certificates", getInventoryCertificates);

export default router;
