import express from "express";
import { 
  createPrintJob, 
  getBarcodeDetails, 
  createBarcode, 
  getRetailerBarcodes 
} from "../controllers/barcodes/barcodesController.js";
import { bulkPrintBarcodes, previewBarcodes } from "../controllers/barcodes/barcodePrintController.js";
import { catalogueAuth } from "../middleware/catalogueAuth.js";

const router = express.Router();

router.get("/", getRetailerBarcodes);
router.post("/", createBarcode);
router.post("/print-job", createPrintJob);
router.post("/bulk-print", ...catalogueAuth, bulkPrintBarcodes);
router.post("/preview", ...catalogueAuth, previewBarcodes);
router.get("/:code", getBarcodeDetails);


export default router;


