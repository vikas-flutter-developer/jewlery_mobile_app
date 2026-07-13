import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { inventoryCatalogueRepository } from "../../repositories/catalogue/inventoryCatalogueRepository.js";
import { barcodePrintHistoryRepository } from "../../repositories/catalogue/inventoryCatalogueRepository.js";
import { storageService } from "../storage/storageService.js";
import { catalogueAuditService, AuditContext } from "./catalogueAuditService.js";
import { CatalogueValidationError } from "./inventoryPhotoService.js";
import { withMongoTransaction } from "../../../lib/mongoTransaction.js";

export type PrinterType = "THERMAL_58MM" | "THERMAL_80MM" | "JEWELLERY_TAG" | "A4_SHEET";

export type BarcodePrintFilter = {
  skuIds?: string[];
  category?: string;
  vendorId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const LAYOUTS: Record<
  PrinterType,
  { pageWidth: number; pageHeight: number; labelWidth: number; labelHeight: number; cols: number; rows: number; margin: number }
> = {
  THERMAL_58MM: { pageWidth: 165, pageHeight: 842, labelWidth: 155, labelHeight: 120, cols: 1, rows: 7, margin: 5 },
  THERMAL_80MM: { pageWidth: 227, pageHeight: 842, labelWidth: 210, labelHeight: 130, cols: 1, rows: 6, margin: 8 },
  JEWELLERY_TAG: { pageWidth: 595, pageHeight: 842, labelWidth: 180, labelHeight: 100, cols: 3, rows: 8, margin: 20 },
  A4_SHEET: { pageWidth: 595, pageHeight: 842, labelWidth: 130, labelHeight: 90, cols: 4, rows: 9, margin: 20 },
};

const fmtPrice = (n: number | undefined | null) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtWeight = (n: number | undefined | null) => `${Number(n ?? 0).toFixed(3)}g`;

async function drawLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  item: any,
  qrDataUrl: string
) {
  doc.rect(x, y, width, height).stroke("#cccccc");

  doc.fontSize(7).fillColor("#666666").text("AuraJewel", x + 4, y + 4, { width: width - 8 });
  doc.fontSize(9).fillColor("#000000").text(String(item.name || item.sku || "Product"), x + 4, y + 14, {
    width: width - 8,
    ellipsis: true,
  });

  doc.fontSize(8).text(`SKU: ${item.sku || "-"}`, x + 4, y + 28);
  doc.text(`Purity: ${item.purity || "-"}`, x + 4, y + 40);
  doc.text(`Wt: ${fmtWeight(item.netWeight ?? item.weight)}`, x + 4, y + 52);
  doc.text(`Price: ${fmtPrice(item.sellingRate ?? item.price)}`, x + 4, y + 64);

  if (item.hallmarkNumber || item.hallmarkCertificate) {
    doc.fontSize(7).text(`HM: ${item.hallmarkNumber || item.hallmarkCertificate}`, x + 4, y + 76, {
      width: width - 50,
    });
  }
  if (item.rfid) {
    doc.fontSize(6).text(`RFID: ${item.rfid}`, x + 4, y + 86, { width: width - 50 });
  }

  const barcodeText = String(item.barcode || item.sku || "");
  doc.fontSize(7).text(barcodeText, x + 4, y + height - 14, { width: width - 50 });

  if (qrDataUrl) {
    doc.image(qrDataUrl, x + width - 42, y + height - 48, { width: 38, height: 38 });
  }
}

async function generatePdfBuffer(items: any[], printerType: PrinterType): Promise<Buffer> {
  const layout = LAYOUTS[printerType];
  const labelsPerPage = layout.cols * layout.rows;

  const qrCache = new Map<string, string>();
  for (const item of items) {
    const code = String(item.barcode || item.sku || item._id);
    if (!qrCache.has(code)) {
      qrCache.set(code, await QRCode.toDataURL(code, { margin: 0, width: 120 }));
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [layout.pageWidth, layout.pageHeight],
      margin: 0,
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (let i = 0; i < items.length; i++) {
      const pageIndex = Math.floor(i / labelsPerPage);
      const indexOnPage = i % labelsPerPage;

      if (indexOnPage === 0) {
        doc.addPage({ size: [layout.pageWidth, layout.pageHeight], margin: 0 });
      }

      const col = indexOnPage % layout.cols;
      const row = Math.floor(indexOnPage / layout.cols);
      const x = layout.margin + col * (layout.labelWidth + 4);
      const y = layout.margin + row * (layout.labelHeight + 4);

      const item = items[i];
      const code = String(item.barcode || item.sku || item._id);
      const qrDataUrl = qrCache.get(code) || "";

      drawLabel(doc, x, y, layout.labelWidth, layout.labelHeight, item, qrDataUrl);
    }

    if (items.length === 0) {
      doc.addPage({ size: [layout.pageWidth, layout.pageHeight], margin: 0 });
      doc.fontSize(12).text("No items matched the filter criteria.", 20, 20);
    }

    doc.end();
  });
}

export const barcodeTagPdfService = {
  async resolveItems(filter: BarcodePrintFilter) {
    const criteria: Parameters<typeof inventoryCatalogueRepository.findByFilter>[0] = {};

    if (filter.skuIds?.length) criteria.skuIds = filter.skuIds;
    if (filter.category) criteria.category = filter.category;
    if (filter.vendorId) criteria.vendorId = filter.vendorId;
    if (filter.branchId) criteria.branchId = filter.branchId;
    if (filter.dateFrom) criteria.dateFrom = new Date(filter.dateFrom);
    if (filter.dateTo) criteria.dateTo = new Date(filter.dateTo);

    const hasFilter =
      filter.skuIds?.length ||
      filter.category ||
      filter.vendorId ||
      filter.branchId ||
      filter.dateFrom ||
      filter.dateTo;

    if (!hasFilter) {
      throw new CatalogueValidationError(
        "Provide skuIds, category, vendorId, branchId, or date range filter"
      );
    }

    return inventoryCatalogueRepository.findByFilter(criteria);
  },

  async preview(filter: BarcodePrintFilter, printerType: PrinterType, audit: AuditContext) {
    const items = await this.resolveItems(filter);
    const sample = items.slice(0, Math.min(5, items.length));

    await catalogueAuditService.log("BARCODE_PREVIEW", undefined, audit, {
      printerType,
      skuCount: items.length,
      sampleSkus: sample.map((i) => i.sku),
    });

    return {
      printerType,
      totalTags: items.length,
      skuCount: new Set(items.map((i) => i.sku)).size,
      preview: sample.map((item) => ({
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        purity: item.purity,
        weight: item.netWeight ?? item.weight,
        price: item.sellingRate ?? item.price,
        hallmarkNumber: item.hallmarkNumber || item.hallmarkCertificate,
        rfid: item.rfid,
      })),
    };
  },

  async bulkPrint(
    filter: BarcodePrintFilter,
    printerType: PrinterType,
    audit: AuditContext,
    persistHistory = true
  ) {
    const items = await this.resolveItems(filter);
    if (items.length === 0) {
      throw new CatalogueValidationError("No inventory items matched the filter");
    }

    const printJobId = `PRINT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const pdfBuffer = await generatePdfBuffer(items, printerType);
    const stored = await storageService.saveBarcodePdf(pdfBuffer, printJobId);

    if (persistHistory) {
      await withMongoTransaction(async (session) => {
        await barcodePrintHistoryRepository.create(
          {
            printJobId,
            userId: audit.userId,
            userEmail: audit.userEmail,
            printerType,
            numberOfTags: items.length,
            skuCount: new Set(items.map((i) => i.sku)).size,
            generatedPdfPath: stored.path,
            generatedPdfUrl: stored.url,
            filterCriteria: filter,
            skuIds: filter.skuIds,
            status: "COMPLETED",
          },
          session
        );
      });

      await catalogueAuditService.log("BARCODE_PRINT", printJobId, audit, {
        printerType,
        numberOfTags: items.length,
        pdfUrl: stored.url,
      });
    }

    return {
      printJobId,
      printerType,
      numberOfTags: items.length,
      skuCount: new Set(items.map((i) => i.sku)).size,
      pdfUrl: stored.url,
    };
  },
};
