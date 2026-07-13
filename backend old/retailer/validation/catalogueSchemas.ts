import { PrinterType } from "../services/catalogue/barcodeTagPdfService.js";

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;
export const MAX_PHOTOS_PER_SKU = 10;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;
export const VALID_PRINTER_TYPES: PrinterType[] = [
  "THERMAL_58MM",
  "THERMAL_80MM",
  "JEWELLERY_TAG",
  "A4_SHEET",
];

export const BULK_IMPORT_COLUMNS = [
  "SKU Code",
  "Barcode",
  "Product Name",
  "Category",
  "Sub Category",
  "Metal",
  "Purity",
  "Gross Weight",
  "Net Weight",
  "Stone Weight",
  "Making Charges",
  "Stone Charges",
  "Purchase Rate",
  "Selling Rate",
  "Vendor",
  "Branch",
  "Location",
  "RFID",
  "Hallmark Number",
  "Description",
] as const;

export type BarcodePrintRequest = {
  skuIds?: string[];
  category?: string;
  vendorId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  printerType?: PrinterType;
};

export const validateBarcodePrintRequest = (body: Record<string, unknown>): string | null => {
  const hasFilter =
    (Array.isArray(body.skuIds) && body.skuIds.length > 0) ||
    body.category ||
    body.vendorId ||
    body.branchId ||
    body.dateFrom ||
    body.dateTo;
  if (!hasFilter) {
    return "Provide skuIds, category, vendorId, branchId, or date range";
  }
  if (body.printerType) {
    const type = String(body.printerType).toUpperCase();
    if (!VALID_PRINTER_TYPES.includes(type as PrinterType)) {
      return "Invalid printerType";
    }
  }
  return null;
};
