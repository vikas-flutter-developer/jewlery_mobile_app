import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { parse as parseCsv } from "fast-csv";
import { withMongoTransaction } from "../../../lib/mongoTransaction.js";
import {
  importHistoryRepository,
  inventoryCatalogueRepository,
} from "../../repositories/catalogue/inventoryCatalogueRepository.js";
import { storageService } from "../storage/storageService.js";
import { catalogueAuditService, AuditContext } from "./catalogueAuditService.js";
import { CatalogueValidationError } from "./inventoryPhotoService.js";

const BATCH_SIZE = 500;

const COLUMN_MAP: Record<string, string> = {
  "sku code": "sku",
  sku: "sku",
  barcode: "barcode",
  "product name": "name",
  name: "name",
  category: "category",
  "sub category": "subCategory",
  subcategory: "subCategory",
  metal: "metal",
  purity: "purity",
  "gross weight": "grossWeight",
  grossweight: "grossWeight",
  "net weight": "netWeight",
  netweight: "netWeight",
  "stone weight": "stoneWeight",
  stoneweight: "stoneWeight",
  "making charges": "makingCharges",
  makingcharges: "makingCharges",
  "stone charges": "stoneCharges",
  stonecharges: "stoneCharges",
  "purchase rate": "purchaseRate",
  purchaserate: "purchaseRate",
  "selling rate": "sellingRate",
  sellingrate: "sellingRate",
  vendor: "vendor",
  branch: "branch",
  location: "location",
  rfid: "rfid",
  "hallmark number": "hallmarkNumber",
  hallmarknumber: "hallmarkNumber",
  description: "description",
};

const MANDATORY_FIELDS = ["sku", "barcode", "name", "branch", "purity", "grossWeight", "netWeight"];

type ParsedRow = Record<string, string | number | undefined> & { _rowNumber: number };

type RowError = { row: number; sku?: string; errors: string[] };

const normalizeHeader = (header: string) =>
  String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

const mapRow = (raw: Record<string, unknown>, rowNumber: number): ParsedRow => {
  const mapped: ParsedRow = { _rowNumber: rowNumber };
  for (const [key, value] of Object.entries(raw)) {
    const field = COLUMN_MAP[normalizeHeader(key)];
    if (field) {
      mapped[field] = value !== null && value !== undefined ? String(value).trim() : undefined;
    }
  }
  return mapped;
};

const parseNumericField = (value: unknown, fieldName: string, errors: string[], allowZero = false) => {
  if (value === undefined || value === "") {
    errors.push(`${fieldName} is required`);
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || (!allowZero && num <= 0)) {
    errors.push(`Invalid ${fieldName}: ${value}`);
    return null;
  }
  return num;
};

const computeFineWeight = (netWeight: number, purity: string) => {
  const match = String(purity).match(/(\d+(?:\.\d+)?)/);
  const karat = match ? Number(match[1]) : 22;
  const factor = karat <= 24 ? karat / 24 : 0.916;
  return Number((netWeight * factor).toFixed(3));
};

const sanitizeSku = (sku: string) =>
  sku
    .replace(/[^A-Z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

export type BulkImportResult = {
  importId: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  totalRows: number;
  processingTimeMs: number;
  status: string;
  errorReportUrl?: string;
  errors: RowError[];
};

async function* streamExcelRows(filePath: string): AsyncGenerator<ParsedRow> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") {
    let rowNumber = 1;
    let headers: string[] = [];
    const stream = fs.createReadStream(filePath);
    for await (const row of stream.pipe(parseCsv({ headers: false }))) {
      if (rowNumber === 1) {
        headers = row.map((cell: string) => String(cell || ""));
        rowNumber++;
        continue;
      }
      const raw: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        raw[header] = row[idx];
      });
      yield mapRow(raw, rowNumber);
      rowNumber++;
    }
    return;
  }

  if (ext === ".xls") {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: "" });
    if (rows.length < 2) return;
    const headers = rows[0].map((cell) => String(cell ?? ""));
    for (let i = 1; i < rows.length; i++) {
      const raw: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        raw[header] = rows[i][idx];
      });
      yield mapRow(raw, i + 1);
    }
    return;
  }

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: "emit",
    sharedStrings: "cache",
    styles: "ignore",
    worksheets: "emit",
  });

  let rowNumber = 0;
  let headers: string[] = [];

  for await (const worksheetReader of workbookReader) {
    for await (const row of worksheetReader) {
      rowNumber++;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (rowNumber === 1) {
        headers = values.map((v) => String(v ?? ""));
        continue;
      }
      const raw: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        raw[header] = values[idx];
      });
      yield mapRow(raw, rowNumber);
    }
    break;
  }
}

export const bulkImportService = {
  validateFileExtension(fileName: string) {
    const ext = path.extname(fileName).toLowerCase();
    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      throw new CatalogueValidationError("Invalid file format. Allowed: XLSX, XLS, CSV");
    }
    return ext;
  },

  async processImport(
    filePath: string,
    originalFileName: string,
    uploadedBy: string,
    audit: AuditContext
  ): Promise<BulkImportResult> {
    const startTime = Date.now();
    const importId = `IMP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    this.validateFileExtension(originalFileName);

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new CatalogueValidationError("Uploaded file is empty");
    }

    await importHistoryRepository.create({
      importId,
      uploadedBy: audit.userId,
      uploadedByEmail: audit.userEmail,
      fileName: path.basename(filePath),
      originalFileName,
      status: "PROCESSING",
      uploadDate: new Date(),
    });

    const [{ skus, barcodes, rfids }, branchMap, vendorMap] = await Promise.all([
      inventoryCatalogueRepository.findExistingIdentifiers(),
      inventoryCatalogueRepository.getBranchMap(),
      inventoryCatalogueRepository.getVendorMap(),
    ]);

    const fileSkus = new Set<string>();
    const fileBarcodes = new Set<string>();
    const fileRfids = new Set<string>();

    const errors: RowError[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalRows = 0;

    let batch: any[] = [];

    const flushBatch = async () => {
      if (!batch.length) return;
      await withMongoTransaction(async (session) => {
        await inventoryCatalogueRepository.bulkWrite(batch, session);
      });
      importedCount += batch.length;
      batch = [];
    };

    try {
      for await (const row of streamExcelRows(filePath)) {
        totalRows++;
        const rowErrors: string[] = [];
        const sku = row.sku ? String(row.sku).trim() : "";
        const barcode = row.barcode ? String(row.barcode).trim() : "";
        const name = row.name ? String(row.name).trim() : "";

        for (const field of MANDATORY_FIELDS) {
          if (!row[field] && row[field] !== 0) {
            rowErrors.push(`Missing mandatory field: ${field}`);
          }
        }

        const grossWeight = parseNumericField(row.grossWeight, "Gross Weight", rowErrors);
        const netWeight = parseNumericField(row.netWeight, "Net Weight", rowErrors);
        const stoneWeight =
          row.stoneWeight !== undefined && row.stoneWeight !== ""
            ? parseNumericField(row.stoneWeight, "Stone Weight", rowErrors, true)
            : 0;

        const branchRaw = row.branch ? String(row.branch).trim() : "";
        const branchId =
          branchMap.byCode.get(branchRaw.toUpperCase()) ||
          branchMap.byName.get(branchRaw.toUpperCase()) ||
          (branchRaw ? branchRaw : null);
        if (!branchId) {
          rowErrors.push(`Invalid branch: ${branchRaw}`);
        }

        let vendorId: string | undefined;
        if (row.vendor) {
          const vendorRaw = String(row.vendor).trim();
          vendorId =
            vendorMap.byId.get(vendorRaw) ||
            vendorMap.byName.get(vendorRaw.toUpperCase());
          if (!vendorId) {
            rowErrors.push(`Invalid vendor: ${vendorRaw}`);
          }
        }

        const skuKey = sku.toUpperCase();
        if (sku && (skus.has(skuKey) || fileSkus.has(skuKey))) {
          rowErrors.push(`Duplicate SKU: ${sku}`);
        }
        if (barcode && (barcodes.has(barcode) || fileBarcodes.has(barcode))) {
          rowErrors.push(`Duplicate Barcode: ${barcode}`);
        }
        const rfidVal = row.rfid ? String(row.rfid).trim() : "";
        if (rfidVal && (rfids.has(rfidVal) || fileRfids.has(rfidVal))) {
          rowErrors.push(`Duplicate RFID: ${rfidVal}`);
        }

        if (rowErrors.length > 0) {
          const isDuplicateOnly = rowErrors.every((e) => e.startsWith("Duplicate "));
          if (isDuplicateOnly) {
            skippedCount++;
          } else {
            failedCount++;
          }
          errors.push({ row: row._rowNumber, sku, errors: rowErrors });
          continue;
        }

        fileSkus.add(skuKey);
        fileBarcodes.add(barcode);
        if (rfidVal) fileRfids.add(rfidVal);
        skus.add(skuKey);
        barcodes.add(barcode);
        if (rfidVal) rfids.add(rfidVal);

        const purity = String(row.purity);
        const parsedNet = netWeight as number;
        const parsedGross = grossWeight as number;
        const fineWeight = computeFineWeight(parsedNet, purity);
        const tag = `TAG-${sanitizeSku(sku)}-${barcode}`;
        const hallmarkNumber = row.hallmarkNumber ? String(row.hallmarkNumber) : undefined;

        const doc = {
          sku,
          barcode,
          tag,
          name,
          branchId,
          purity,
          grossWeight: parsedGross,
          netWeight: parsedNet,
          fineWeight,
          diamondWeight: stoneWeight || 0,
          huid: hallmarkNumber || rfidVal || "N/A",
          category: row.category ? String(row.category) : undefined,
          subCategory: row.subCategory ? String(row.subCategory) : undefined,
          metal: row.metal ? String(row.metal) : row.category ? String(row.category) : undefined,
          stoneWeight: stoneWeight || 0,
          makingCharges: row.makingCharges ? Number(row.makingCharges) : 0,
          stoneCharges: row.stoneCharges ? Number(row.stoneCharges) : 0,
          purchaseRate: row.purchaseRate ? Number(row.purchaseRate) : undefined,
          sellingRate: row.sellingRate ? Number(row.sellingRate) : undefined,
          price: row.sellingRate ? Number(row.sellingRate) : undefined,
          vendorId,
          location: row.location ? String(row.location) : undefined,
          rfid: rfidVal || undefined,
          hallmarkNumber,
          hallmarkCertificate: hallmarkNumber,
          description: row.description ? String(row.description) : undefined,
          type: row.metal ? String(row.metal) : undefined,
          status: "In Stock",
          stock: 1,
          createdAt: new Date(),
        };

        batch.push({ insertOne: { document: doc } });

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }

      if (totalRows === 0) {
        throw new CatalogueValidationError("Excel file contains no data rows");
      }

      await flushBatch();

      let errorReportUrl: string | undefined;
      let errorReportPath: string | undefined;

      if (errors.length > 0) {
        const csvLines = ["Row,SKU,Errors"];
        for (const err of errors) {
          csvLines.push(`${err.row},"${(err.sku || "").replace(/"/g, '""')}","${err.errors.join("; ").replace(/"/g, '""')}"`);
        }
        const csvBuffer = Buffer.from(csvLines.join("\n"), "utf-8");
        const stored = await storageService.saveImportErrorReport(
          csvBuffer,
          importId,
          `import-errors-${importId}.csv`
        );
        errorReportUrl = stored.url;
        errorReportPath = stored.path;
      }

      const processingTimeMs = Date.now() - startTime;
      const status =
        failedCount > 0 && importedCount > 0
          ? "PARTIAL"
          : failedCount > 0
            ? "FAILED"
            : "COMPLETED";

      await importHistoryRepository.update(importId, {
        importedRecords: importedCount,
        skippedRecords: skippedCount,
        failedRecords: failedCount,
        totalRows,
        processingTimeMs,
        status,
        errorReportPath,
        errorReportUrl,
        summary: `Imported ${importedCount}, skipped ${skippedCount}, failed ${failedCount}`,
      });

      await catalogueAuditService.log("BULK_IMPORT", importId, audit, {
        importedCount,
        skippedCount,
        failedCount,
        totalRows,
      });

      return {
        importId,
        importedCount,
        skippedCount,
        failedCount,
        totalRows,
        processingTimeMs,
        status,
        errorReportUrl,
        errors: errors.slice(0, 100),
      };
    } catch (error) {
      await importHistoryRepository.update(importId, {
        status: "FAILED",
        processingTimeMs: Date.now() - startTime,
        summary: error instanceof Error ? error.message : "Import failed",
      });
      throw error;
    }
  },
};
