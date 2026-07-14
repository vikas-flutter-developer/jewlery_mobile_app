import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { Inventory as RetailerInventory } from "../../models/index.js";
import { ManufacturerInventory } from "../../../manufacturer/models/index.js";
import DefaultInventory from "../../../models/Inventory.js";
import PDFDocument from "pdfkit";

const getInventoryModel = (req: any) => {
  const storeType = req.user?.storeType || (req.user?.role === "ADMIN" ? "MANUFACTURER" : "RETAILER");
  if (storeType === "MANUFACTURER") return ManufacturerInventory;
  return RetailerInventory;
};

const getFilteredInventory = async (req: AuthRequest) => {
  const { branchId, status, product } = req.query;
  const InventoryModel = getInventoryModel(req);
  
  const query: any = {};
  if (branchId) {
    query.branchId = branchId;
  }
  if (status) {
    query.huidStatus = status;
  }
  if (product) {
    query.$or = [
      { name: { $regex: product, $options: "i" } },
      { sku: { $regex: product, $options: "i" } },
      { barcode: { $regex: product, $options: "i" } }
    ];
  }
  return await InventoryModel.find(query).populate("bisLicenceId").lean();
};

const generateComplianceCsv = (list: any[]) => {
  let csv = "Barcode,Product Name,SKU,Branch ID,HUID Number,HUID Status,Hallmark Status,Compliance Date\n";
  list.forEach(item => {
    const compDate = item.complianceDate ? new Date(item.complianceDate).toISOString().split("T")[0] : "N/A";
    csv += `"${item.barcode || ""}","${String(item.name || "").replace(/"/g, '""')}","${item.sku || ""}","${item.branchId || ""}","${item.huidNumber || ""}","${item.huidStatus || "PENDING"}","${item.hallmarkStatus || "PENDING"}","${compDate}"\n`;
  });
  return csv;
};

const generateExceptionsCsv = (list: any[]) => {
  let csv = "Barcode,Product Name,SKU,Branch ID,HUID Number,HUID Status,Hallmark Status,Issue/Exception\n";
  list.forEach(item => {
    let issue = "Non-Compliant";
    if (!item.huidNumber) {
      issue = "Missing HUID";
    } else if (item.huidStatus === "INVALID") {
      issue = "Invalid HUID Format or Licence";
    } else if (item.huidStatus === "PENDING") {
      issue = "Pending Compliance Check";
    }
    csv += `"${item.barcode || ""}","${String(item.name || "").replace(/"/g, '""')}","${item.sku || ""}","${item.branchId || ""}","${item.huidNumber || ""}","${item.huidStatus || "PENDING"}","${item.hallmarkStatus || "PENDING"}","${issue}"\n`;
  });
  return csv;
};

const generatePdfComplianceReport = (res: Response, list: any[], title: string) => {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${title.toLowerCase().replace(/\s+/g, "_")}.pdf`);
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(18).text(`AURAJEWEL - ${title.toUpperCase()}`, { align: "center" });
  doc.fontSize(10).font("Helvetica").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(2);

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Barcode", 40, doc.y, { width: 90, continued: true });
  doc.text("Name", 130, doc.y, { width: 140, continued: true });
  doc.text("HUID", 270, doc.y, { width: 90, continued: true });
  doc.text("HUID Status", 360, doc.y, { width: 80, continued: true });
  doc.text("Hallmark Status", 440, doc.y, { width: 100 });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(9);

  list.forEach(item => {
    const y = doc.y;
    if (y > 700) doc.addPage();
    doc.text(item.barcode || "N/A", 40, doc.y, { width: 90, continued: true });
    doc.text(item.name || "N/A", 130, doc.y, { width: 140, continued: true });
    doc.text(item.huidNumber || "N/A", 270, doc.y, { width: 90, continued: true });
    doc.text(item.huidStatus || "PENDING", 360, doc.y, { width: 80, continued: true });
    doc.text(item.hallmarkStatus || "PENDING", 440, doc.y, { width: 100 });
    doc.moveDown(0.5);
  });

  doc.end();
};

export const getHuidComplianceReport = async (req: AuthRequest, res: Response) => {
  try {
    const list = await getFilteredInventory(req);
    const { format } = req.query;

    if (format === "pdf") {
      return generatePdfComplianceReport(res, list, "HUID Compliance Report");
    }

    if (format === "excel" || format === "csv") {
      const csv = generateComplianceCsv(list);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=huid_compliance_report.csv");
      return res.status(200).send(csv);
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getHuidExceptionsReport = async (req: AuthRequest, res: Response) => {
  try {
    const list = await getFilteredInventory(req);
    // Filter down to only exceptions (non-compliant)
    const exceptions = list.filter(item => item.huidStatus !== "COMPLIANT" || !item.huidNumber);
    const { format } = req.query;

    if (format === "pdf") {
      return generatePdfComplianceReport(res, exceptions, "HUID Exceptions Report");
    }

    if (format === "excel" || format === "csv") {
      const csv = generateExceptionsCsv(exceptions);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=huid_exceptions_report.csv");
      return res.status(200).send(csv);
    }

    return res.json({ success: true, data: exceptions });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
