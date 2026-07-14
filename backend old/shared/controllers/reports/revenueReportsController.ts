import { Request, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { SuperAdminSubscription as Subscription, SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import InvoiceModel from "../../../models/Invoice.js";

const getDbReady = () => mongoose.connection.readyState === 1 && isDbConnected();

const logExportAction = async (actor: string, reportName: string, format: string) => {
  try {
    if (getDbReady()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action: `export-revenue-${reportName}-${format}`,
        entityType: "RevenueAnalytics",
        entityId: "revenue-analytics",
        details: `Exported ${reportName} in ${format} format.`,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write revenue report export audit log:", err);
  }
};

// ─── GET /api/reports/revenue-analytics ───────────────────────────────────────
export const getRevenueAnalyticsReport = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    const { format = "pdf", startDate, endDate } = req.query;

    await logExportAction(actor, "overall", String(format));

    if (!getDbReady()) {
      return res.status(500).json({ success: false, error: "Database offline" });
    }

    const stores = await Subscription.find({}).lean();
    const resultList: any[] = [];

    const dateFilter: any = { status: "final" };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
    }

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const InvModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");

      const agg = await InvModel.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$grandTotal" },
            taxable: { $sum: "$gstBreakup.taxableValue" },
            gst: { $sum: "$gstBreakup.totalGst" },
            count: { $sum: 1 }
          }
        }
      ]);

      const data = agg[0] || { revenue: 0, taxable: 0, gst: 0, count: 0 };
      resultList.push({
        shopName: s.shopName,
        revenue: Math.round(data.revenue * 100) / 100,
        taxable: Math.round(data.taxable * 100) / 100,
        gst: Math.round(data.gst * 100) / 100,
        invoices: data.count
      });
    }

    if (format === "csv") {
      let csv = "Overall Revenue Performance Report\n";
      csv += "Store Name,Invoices Count,Taxable Value,GST Collected,Total Revenue\n";
      resultList.forEach(r => {
        csv += `"${r.shopName}",${r.invoices},${r.taxable},${r.gst},${r.revenue}\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=revenue_analytics_report.csv");
      return res.status(200).send(csv);
    }

    // PDF Render
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=revenue_analytics_report.pdf");
    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text("AURAJEWEL – REVENUE PERFORMANCE REPORT", { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    // Table Header
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Store Shop", 40, doc.y, { width: 150, continued: true });
    doc.text("Invoices", 190, doc.y, { width: 60, continued: true });
    doc.text("Taxable Value", 250, doc.y, { width: 90, continued: true });
    doc.text("GST Collected", 340, doc.y, { width: 90, continued: true });
    doc.text("Total Revenue", 430, doc.y, { width: 90 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    resultList.forEach((r: any) => {
      if (doc.y > 700) doc.addPage();
      doc.text(r.shopName, 40, doc.y, { width: 150, continued: true });
      doc.text(String(r.invoices), 190, doc.y, { width: 60, continued: true });
      doc.text(`₹${r.taxable.toLocaleString()}`, 250, doc.y, { width: 90, continued: true });
      doc.text(`₹${r.gst.toLocaleString()}`, 340, doc.y, { width: 90, continued: true });
      doc.text(`₹${r.revenue.toLocaleString()}`, 430, doc.y, { width: 90 });
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/reports/revenue-by-store ────────────────────────────────────────
export const getRevenueByStoreReport = async (req: Request, res: Response) => {
  try {
    return getRevenueAnalyticsReport(req, res); // Share base statistics comparison report
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/reports/revenue-by-product ──────────────────────────────────────
export const getRevenueByProductReport = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    const { format = "pdf" } = req.query;

    await logExportAction(actor, "product", String(format));

    if (!getDbReady()) {
      return res.status(500).json({ success: false, error: "Database offline" });
    }

    const stores = await Subscription.find({}).lean();
    const productMap = new Map<string, { metalType: string; totalRevenue: number; qtySold: number }>();

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const InvModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");

      const itemsSold = await InvModel.aggregate([
        { $match: { status: "final" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            metalType: { $first: "$items.metalType" },
            totalRevenue: { $sum: "$items.itemTotal" },
            qtySold: { $sum: "$items.qty" }
          }
        }
      ]);

      itemsSold.forEach((item: any) => {
        const key = item._id;
        const existing = productMap.get(key) || { metalType: item.metalType || "GOLD", totalRevenue: 0, qtySold: 0 };
        productMap.set(key, {
          metalType: item.metalType || existing.metalType,
          totalRevenue: existing.totalRevenue + item.totalRevenue,
          qtySold: existing.qtySold + item.qtySold
        });
      });
    }

    const dataList = Array.from(productMap.entries()).map(([name, info]) => ({ name, ...info }));

    if (format === "csv") {
      let csv = "Product Revenue Performance Report\n";
      csv += "Product Name,Metal Type,Quantity Sold,Total Revenue\n";
      dataList.forEach(d => {
        csv += `"${d.name}","${d.metalType}",${d.qtySold},${d.totalRevenue}\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=revenue_by_product.csv");
      return res.status(200).send(csv);
    }

    // PDF
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=revenue_by_product.pdf");
    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text("AURAJEWEL – PRODUCT SALES REVENUE REPORT", { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Product Item", 40, doc.y, { width: 200, continued: true });
    doc.text("Metal Type", 240, doc.y, { width: 80, continued: true });
    doc.text("Quantity Sold", 320, doc.y, { width: 80, continued: true });
    doc.text("Total Revenue", 400, doc.y, { width: 100 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    dataList.forEach((d: any) => {
      if (doc.y > 700) doc.addPage();
      doc.text(d.name, 40, doc.y, { width: 200, continued: true });
      doc.text(d.metalType, 240, doc.y, { width: 80, continued: true });
      doc.text(String(d.qtySold), 320, doc.y, { width: 80, continued: true });
      doc.text(`₹${d.totalRevenue.toLocaleString()}`, 400, doc.y, { width: 100 });
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
