import { Request, Response } from "express";
import mongoose from "mongoose";
import { Customer } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { getAllFallbackCustomers } from "../../../lib/fallbackStore.js";
import PDFDocument from "pdfkit";

// Helper to filter customers by date, branch, and tier
const getFilteredCustomers = async (
  targetTier: "VIP" | "BLACKLISTED",
  query: any
) => {
  const { startDate, endDate, branchId } = query;
  let list: any[] = [];

  if (isDbConnected()) {
    const filter: any = { customerTier: targetTier };
    if (branchId) {
      filter.preferredBranch = branchId;
    }
    
    // Date filter: vipSince for VIP, blacklistDate for Blacklisted, fallback to customerSince/createdAt
    const dateField = targetTier === "VIP" ? "vipSince" : "blacklistDate";
    if (startDate || endDate) {
      filter[dateField] = {};
      if (startDate) filter[dateField].$gte = new Date(startDate);
      if (endDate) filter[dateField].$lte = new Date(endDate);
    }
    
    list = await Customer.find(filter).populate("preferredBranch", "name code").lean();
  } else {
    const all = await getAllFallbackCustomers();
    list = all.filter(c => {
      if (String(c.customerTier || "").toUpperCase() !== targetTier) return false;
      if (branchId && String(c.preferredBranch || "") !== String(branchId)) return false;
      
      const dateVal = targetTier === "VIP" ? c.vipSince : c.blacklistDate;
      const dateObj = dateVal ? new Date(dateVal) : new Date(c.createdAt || c.customerSince);
      if (startDate && dateObj < new Date(startDate)) return false;
      if (endDate && dateObj > new Date(endDate)) return false;
      return true;
    });
  }
  return list;
};

// Generate CSV string
const generateCsvContent = (tier: "VIP" | "BLACKLISTED", list: any[]) => {
  if (tier === "VIP") {
    let csv = "Customer Name,Email,Phone,VIP Since,Outstanding Balance,Loyalty Points,Notes\n";
    list.forEach(c => {
      const vipSince = c.vipSince ? new Date(c.vipSince).toISOString().split("T")[0] : "N/A";
      csv += `"${String(c.name).replace(/"/g, '""')}","${c.email || ""}",${c.phone || ""},${vipSince},${c.outstandingBalance || 0},${c.loyaltyPoints || 0},"${String(c.tierNotes || "").replace(/"/g, '""')}"\n`;
    });
    return csv;
  } else {
    let csv = "Customer Name,Email,Phone,Blacklisted Date,Blacklisted By,Blacklist Reason\n";
    list.forEach(c => {
      const blacklistDate = c.blacklistDate ? new Date(c.blacklistDate).toISOString().split("T")[0] : "N/A";
      csv += `"${String(c.name).replace(/"/g, '""')}","${c.email || ""}",${c.phone || ""},${blacklistDate},"${c.blacklistedBy || ""}","${String(c.blacklistReason || "").replace(/"/g, '""')}"\n`;
    });
    return csv;
  }
};

// Generate PDF Document stream
const generatePdfReport = (res: Response, tier: "VIP" | "BLACKLISTED", list: any[]) => {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${tier.toLowerCase()}_customers_report.pdf`);
  doc.pipe(res);

  // Document Title
  doc.font("Helvetica-Bold").fontSize(18).text(`AURAJEWEL - ${tier} CUSTOMERS REPORT`, { align: "center" });
  doc.fontSize(10).font("Helvetica").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(2);

  // Table header
  if (tier === "VIP") {
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Customer Name", 40, doc.y, { width: 140, continued: true });
    doc.text("Phone", 180, doc.y, { width: 100, continued: true });
    doc.text("VIP Since", 280, doc.y, { width: 100, continued: true });
    doc.text("Outstanding", 380, doc.y, { width: 80, continued: true });
    doc.text("Points", 460, doc.y, { width: 80 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    list.forEach(c => {
      const vipSince = c.vipSince ? new Date(c.vipSince).toISOString().split("T")[0] : "N/A";
      const y = doc.y;
      if (y > 700) doc.addPage();
      
      doc.text(c.name, 40, doc.y, { width: 140, continued: true });
      doc.text(c.phone || "N/A", 180, doc.y, { width: 100, continued: true });
      doc.text(vipSince, 280, doc.y, { width: 100, continued: true });
      doc.text(`Rs. ${c.outstandingBalance || 0}`, 380, doc.y, { width: 80, continued: true });
      doc.text(String(c.loyaltyPoints || 0), 460, doc.y, { width: 80 });
      doc.moveDown(0.5);
    });
  } else {
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Customer Name", 40, doc.y, { width: 130, continued: true });
    doc.text("Phone", 170, doc.y, { width: 90, continued: true });
    doc.text("Blacklist Date", 260, doc.y, { width: 90, continued: true });
    doc.text("Added By", 350, doc.y, { width: 100, continued: true });
    doc.text("Reason", 450, doc.y, { width: 120 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    list.forEach(c => {
      const blacklistDate = c.blacklistDate ? new Date(c.blacklistDate).toISOString().split("T")[0] : "N/A";
      const y = doc.y;
      if (y > 700) doc.addPage();

      doc.text(c.name, 40, doc.y, { width: 130, continued: true });
      doc.text(c.phone || "N/A", 170, doc.y, { width: 90, continued: true });
      doc.text(blacklistDate, 260, doc.y, { width: 90, continued: true });
      doc.text(c.blacklistedBy || "N/A", 350, doc.y, { width: 100, continued: true });
      doc.text(c.blacklistReason || "compliance risk", 450, doc.y, { width: 120 });
      doc.moveDown(0.5);
    });
  }

  doc.end();
};

export const getVipCustomersReport = async (req: Request, res: Response) => {
  try {
    const list = await getFilteredCustomers("VIP", req.query);
    const { format } = req.query;

    if (format === "pdf") {
      return generatePdfReport(res, "VIP", list);
    }
    
    if (format === "excel" || format === "csv") {
      const csv = generateCsvContent("VIP", list);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=vip_customers_report.csv");
      return res.status(200).send(csv);
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Failed to generate VIP report", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getBlacklistedCustomersReport = async (req: Request, res: Response) => {
  try {
    const list = await getFilteredCustomers("BLACKLISTED", req.query);
    const { format } = req.query;

    if (format === "pdf") {
      return generatePdfReport(res, "BLACKLISTED", list);
    }

    if (format === "excel" || format === "csv") {
      const csv = generateCsvContent("BLACKLISTED", list);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=blacklisted_customers_report.csv");
      return res.status(200).send(csv);
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Failed to generate Blacklisted report", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
