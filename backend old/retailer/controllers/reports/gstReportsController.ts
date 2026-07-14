import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { Invoice as RetailerInvoice } from "../../models/index.js";
import PDFDocument from "pdfkit";

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const buildMatchStage = (req: AuthRequest) => {
  const tenantId = getTenantId(req);
  const { financialYear, branchCode, startDate, endDate } = req.query;

  const match: any = { status: "final" };
  if (tenantId !== "default-shop") match.tenantId = tenantId;
  if (financialYear) match.financialYear = financialYear;
  if (branchCode) match.branchCode = branchCode;
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate as string);
    if (endDate) match.createdAt.$lte = new Date(endDate as string);
  }
  return match;
};

// ─── GST Compliance Report ────────────────────────────────────────────────────

export const getGstComplianceReport = async (req: AuthRequest, res: Response) => {
  try {
    const match = buildMatchStage(req);
    const invoices = await RetailerInvoice.find(match)
      .sort({ createdAt: -1 })
      .lean();

    const { format } = req.query;

    if (format === "pdf") {
      return generateGstPdf(res, invoices, "GST Compliance Report");
    }
    if (format === "csv" || format === "excel") {
      const csv = generateGstComplianceCsv(invoices);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=gst_compliance_report.csv");
      return res.status(200).send(csv);
    }
    return res.json({ success: true, data: invoices });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GST Liability Report ─────────────────────────────────────────────────────

export const getGstLiabilityReport = async (req: AuthRequest, res: Response) => {
  try {
    const match = buildMatchStage(req);
    const monthly = await RetailerInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            financialYear: "$financialYear",
            branchCode: "$branchCode",
          },
          outputGst: { $sum: "$gstBreakup.totalGst" },
          cgst: { $sum: "$gstBreakup.cgstAmount" },
          sgst: { $sum: "$gstBreakup.sgstAmount" },
          igst: { $sum: "$gstBreakup.igstAmount" },
          taxableValue: { $sum: "$gstBreakup.taxableValue" },
          grandTotal: { $sum: "$grandTotal" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const data = monthly.map((m: any) => ({
      year: m._id.year,
      month: m._id.month,
      label: `${m._id.year}-${String(m._id.month).padStart(2, "0")}`,
      financialYear: m._id.financialYear,
      branchCode: m._id.branchCode,
      outputGst: Math.round(m.outputGst * 100) / 100,
      cgst: Math.round(m.cgst * 100) / 100,
      sgst: Math.round(m.sgst * 100) / 100,
      igst: Math.round(m.igst * 100) / 100,
      taxableValue: Math.round(m.taxableValue * 100) / 100,
      grandTotal: Math.round(m.grandTotal * 100) / 100,
      estimatedItc: 0,
      netLiability: Math.round(m.outputGst * 100) / 100,
      invoiceCount: m.invoiceCount,
    }));

    const { format } = req.query;

    if (format === "pdf") {
      return generateLiabilityPdf(res, data);
    }
    if (format === "csv" || format === "excel") {
      const csv = generateLiabilityCsv(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=gst_liability_report.csv");
      return res.status(200).send(csv);
    }
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GST Exceptions Report ────────────────────────────────────────────────────

export const getGstExceptionsReport = async (req: AuthRequest, res: Response) => {
  try {
    const match = buildMatchStage(req);
    const invoices = await RetailerInvoice.find(match).sort({ createdAt: -1 }).lean();

    const exceptions: any[] = [];
    for (const inv of invoices) {
      const issues: string[] = [];
      const storeGstin = inv.storeProfile?.gstin;
      if (!storeGstin || storeGstin.trim() === "") issues.push("MISSING_STORE_GSTIN");
      else if (!GSTIN_REGEX.test(storeGstin.trim())) issues.push("INVALID_STORE_GSTIN");
      const taxableValue = inv.gstBreakup?.taxableValue || 0;
      const totalGst = inv.gstBreakup?.totalGst || 0;
      if (taxableValue > 100 && totalGst === 0) issues.push("ZERO_GST_ON_TAXABLE_VALUE");
      if (inv.items && inv.items.length > 0) {
        const lineGstSum = inv.items.reduce((acc: number, item: any) =>
          acc + (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0), 0);
        if (Math.abs(lineGstSum - (inv.gstBreakup?.totalGst || 0)) > 1) issues.push("GST_AMOUNT_MISMATCH");
      }
      if (!inv.financialYear) issues.push("MISSING_FINANCIAL_YEAR");
      if (issues.length > 0) {
        exceptions.push({
          invoiceNumber: inv.invoiceNumber,
          date: inv.createdAt,
          financialYear: inv.financialYear || "N/A",
          branchCode: inv.branchCode || "MAIN",
          customerName: inv.customerInfo?.name || "Walk-in",
          storeGstin: inv.storeProfile?.gstin || "N/A",
          taxableValue,
          totalGst,
          issues: issues.join(", "),
        });
      }
    }

    const { format } = req.query;

    if (format === "pdf") {
      return generateExceptionsPdf(res, exceptions);
    }
    if (format === "csv" || format === "excel") {
      const csv = generateExceptionsCsv(exceptions);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=gst_exceptions_report.csv");
      return res.status(200).send(csv);
    }
    return res.json({ success: true, data: exceptions });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── CSV Generators ───────────────────────────────────────────────────────────

const generateGstComplianceCsv = (invoices: any[]) => {
  let csv = "Invoice No,Date,FY,Branch,Customer,Store GSTIN,Taxable Value,CGST,SGST,IGST,Total GST,Grand Total\n";
  invoices.forEach(inv => {
    const d = inv.createdAt ? new Date(inv.createdAt).toISOString().split("T")[0] : "N/A";
    csv += `"${inv.invoiceNumber}","${d}","${inv.financialYear || ""}","${inv.branchCode || "MAIN"}","${String(inv.customerInfo?.name || "Walk-in").replace(/"/g, '""')}","${inv.storeProfile?.gstin || ""}",${inv.gstBreakup?.taxableValue || 0},${inv.gstBreakup?.cgstAmount || 0},${inv.gstBreakup?.sgstAmount || 0},${inv.gstBreakup?.igstAmount || 0},${inv.gstBreakup?.totalGst || 0},${inv.grandTotal || 0}\n`;
  });
  return csv;
};

const generateLiabilityCsv = (data: any[]) => {
  let csv = "Period,FY,Branch,Invoice Count,Taxable Value,CGST,SGST,IGST,Output GST,Net Liability\n";
  data.forEach(m => {
    csv += `"${m.label}","${m.financialYear || ""}","${m.branchCode || ""}",${m.invoiceCount},${m.taxableValue},${m.cgst},${m.sgst},${m.igst},${m.outputGst},${m.netLiability}\n`;
  });
  return csv;
};

const generateExceptionsCsv = (exceptions: any[]) => {
  let csv = "Invoice No,Date,FY,Branch,Customer,Store GSTIN,Taxable Value,Total GST,Issues\n";
  exceptions.forEach(e => {
    const d = e.date ? new Date(e.date).toISOString().split("T")[0] : "N/A";
    csv += `"${e.invoiceNumber}","${d}","${e.financialYear}","${e.branchCode}","${String(e.customerName).replace(/"/g, '""')}","${e.storeGstin}",${e.taxableValue},${e.totalGst},"${e.issues}"\n`;
  });
  return csv;
};

// ─── PDF Generators ───────────────────────────────────────────────────────────

const generateGstPdf = (res: Response, invoices: any[], title: string) => {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=gst_compliance_report.pdf`);
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(16).text(`AURAJEWEL – ${title.toUpperCase()}`, { align: "center" });
  doc.fontSize(9).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(8);
  const headers = ["Invoice No", "Date", "FY", "Branch", "Taxable Val", "CGST", "SGST", "IGST", "Total GST", "Grand Total"];
  const widths = [80, 65, 55, 50, 65, 45, 45, 45, 55, 65];
  let x = 40;
  headers.forEach((h, i) => { doc.text(h, x, doc.y, { width: widths[i], continued: i < headers.length - 1 }); x += widths[i]; });
  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(7);
  invoices.forEach((inv: any) => {
    if (doc.y > 530) doc.addPage({ layout: "landscape" });
    const d = inv.createdAt ? new Date(inv.createdAt).toISOString().split("T")[0] : "N/A";
    const row = [
      inv.invoiceNumber || "", d, inv.financialYear || "", inv.branchCode || "MAIN",
      (inv.gstBreakup?.taxableValue || 0).toFixed(2),
      (inv.gstBreakup?.cgstAmount || 0).toFixed(2), (inv.gstBreakup?.sgstAmount || 0).toFixed(2),
      (inv.gstBreakup?.igstAmount || 0).toFixed(2), (inv.gstBreakup?.totalGst || 0).toFixed(2),
      (inv.grandTotal || 0).toFixed(2),
    ];
    x = 40;
    row.forEach((cell, i) => { doc.text(String(cell), x, doc.y, { width: widths[i], continued: i < row.length - 1 }); x += widths[i]; });
    doc.moveDown(0.4);
  });
  doc.end();
};

const generateLiabilityPdf = (res: Response, data: any[]) => {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=gst_liability_report.pdf");
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(16).text("AURAJEWEL – GST LIABILITY REPORT", { align: "center" });
  doc.fontSize(9).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Period", 40, doc.y, { width: 90, continued: true });
  doc.text("FY", 130, doc.y, { width: 60, continued: true });
  doc.text("Invoices", 190, doc.y, { width: 55, continued: true });
  doc.text("Taxable", 245, doc.y, { width: 70, continued: true });
  doc.text("Output GST", 315, doc.y, { width: 75, continued: true });
  doc.text("Net Liability", 390, doc.y, { width: 80 });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(8);

  data.forEach((m: any) => {
    if (doc.y > 700) doc.addPage();
    doc.text(m.label, 40, doc.y, { width: 90, continued: true });
    doc.text(m.financialYear || "", 130, doc.y, { width: 60, continued: true });
    doc.text(String(m.invoiceCount), 190, doc.y, { width: 55, continued: true });
    doc.text(m.taxableValue.toFixed(2), 245, doc.y, { width: 70, continued: true });
    doc.text(m.outputGst.toFixed(2), 315, doc.y, { width: 75, continued: true });
    doc.text(m.netLiability.toFixed(2), 390, doc.y, { width: 80 });
    doc.moveDown(0.4);
  });
  doc.end();
};

const generateExceptionsPdf = (res: Response, exceptions: any[]) => {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=gst_exceptions_report.pdf");
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(16).text("AURAJEWEL – GST EXCEPTIONS REPORT", { align: "center" });
  doc.fontSize(9).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Invoice No", 40, doc.y, { width: 90, continued: true });
  doc.text("Date", 130, doc.y, { width: 70, continued: true });
  doc.text("Customer", 200, doc.y, { width: 120, continued: true });
  doc.text("Issues", 320, doc.y, { width: 240 });
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(8);

  exceptions.forEach((e: any) => {
    if (doc.y > 700) doc.addPage();
    const d = e.date ? new Date(e.date).toISOString().split("T")[0] : "N/A";
    doc.text(e.invoiceNumber, 40, doc.y, { width: 90, continued: true });
    doc.text(d, 130, doc.y, { width: 70, continued: true });
    doc.text(e.customerName, 200, doc.y, { width: 120, continued: true });
    doc.text(e.issues, 320, doc.y, { width: 240 });
    doc.moveDown(0.4);
  });
  doc.end();
};
