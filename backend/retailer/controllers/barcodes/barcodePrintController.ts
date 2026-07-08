import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  barcodeTagPdfService,
  BarcodePrintFilter,
  PrinterType,
} from "../../services/catalogue/barcodeTagPdfService.js";
import { CatalogueValidationError } from "../../services/catalogue/inventoryPhotoService.js";
import { isDbConnected } from "../../../lib/serverState.js";

const VALID_PRINTER_TYPES = new Set<PrinterType>([
  "THERMAL_58MM",
  "THERMAL_80MM",
  "JEWELLERY_TAG",
  "A4_SHEET",
]);

const auditFromRequest = (req: AuthRequest) => ({
  userId: req.user!.id,
  userEmail: req.user!.email,
  userRole: req.user!.role,
  ipAddress: req.ip,
});

const parseFilter = (body: Record<string, unknown>): BarcodePrintFilter => ({
  skuIds: Array.isArray(body.skuIds) ? body.skuIds.map(String) : undefined,
  category: body.category ? String(body.category) : undefined,
  vendorId: body.vendorId ? String(body.vendorId) : undefined,
  branchId: body.branchId ? String(body.branchId) : undefined,
  dateFrom: body.dateFrom ? String(body.dateFrom) : undefined,
  dateTo: body.dateTo ? String(body.dateTo) : undefined,
});

export const bulkPrintBarcodes = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const printerType = String(req.body.printerType || "A4_SHEET").toUpperCase() as PrinterType;
    if (!VALID_PRINTER_TYPES.has(printerType)) {
      return res.status(400).json({ success: false, error: "Invalid printerType" });
    }

    const filter = parseFilter(req.body);
    const result = await barcodeTagPdfService.bulkPrint(filter, printerType, auditFromRequest(req));

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Bulk print error:", error);
    return res.status(500).json({ success: false, error: "Failed to generate barcode PDF" });
  }
};

export const previewBarcodes = async (req: AuthRequest, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database connection required" });
    }

    const printerType = String(req.body.printerType || "A4_SHEET").toUpperCase() as PrinterType;
    if (!VALID_PRINTER_TYPES.has(printerType)) {
      return res.status(400).json({ success: false, error: "Invalid printerType" });
    }

    const filter = parseFilter(req.body);
    const result = await barcodeTagPdfService.preview(filter, printerType, auditFromRequest(req));

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CatalogueValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Barcode preview error:", error);
    return res.status(500).json({ success: false, error: "Failed to preview barcodes" });
  }
};
