import { Request, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import {
  SuperAdminSubscription as Subscription,
  SuperAdminSecurityAudit as SecurityAudit
} from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

const getDbReady = () => mongoose.connection.readyState === 1 && isDbConnected();

const planPrices: Record<string, number> = {
  '1MONTH': 4999,
  '3MONTH': 12999,
  '6MONTH': 22999,
  '1YEAR': 39999,
  '2YEAR': 79999,
};

const planMonths: Record<string, number> = {
  '1MONTH': 1,
  '3MONTH': 3,
  '6MONTH': 6,
  '1YEAR': 12,
  '2YEAR': 24,
};

const logExportAction = async (actor: string, reportName: string, format: string) => {
  try {
    if (getDbReady()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action: `export-subscription-${reportName}-${format}`,
        entityType: "SubscriptionAnalytics",
        entityId: "subscription-analytics",
        details: `Exported subscription ${reportName} in ${format} format.`,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write subscription report export audit log:", err);
  }
};

// ─── GET /super-admin/subscription-analytics/report ──────────────────────────
export const getSubscriptionAnalyticsReport = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    const { format = "pdf", plan, status } = req.query;

    await logExportAction(actor, "performance", String(format));

    if (!getDbReady()) {
      return res.status(500).json({ success: false, error: "Database offline" });
    }

    const filterQuery: any = {};
    if (plan) filterQuery.planName = plan;
    if (status) filterQuery.status = status;

    const subscriptions = await Subscription.find(filterQuery).lean();

    if (format === "csv") {
      let csv = "Subscription Analytics Report\n";
      csv += "Shop Name,Owner,Email,Phone,Plan,Status,Join Date,Expiry Date\n";
      subscriptions.forEach((s: any) => {
        csv += `"${s.shopName}","${s.ownerName || ""}","${s.email}","${s.phone}","${s.planName}","${s.status}","${s.joinDate}","${s.subscriptionExpiry}"\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=subscription_analytics_report.csv");
      return res.status(200).send(csv);
    }

    // PDF Format
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=subscription_analytics_report.pdf");
    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text("AURAJEWEL – SUBSCRIPTION PERFORMANCE REPORT", { align: "center" });
    doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Shop Name", 40, doc.y, { width: 140, continued: true });
    doc.text("Plan", 180, doc.y, { width: 60, continued: true });
    doc.text("Status", 240, doc.y, { width: 70, continued: true });
    doc.text("Join Date", 310, doc.y, { width: 80, continued: true });
    doc.text("Expiry Date", 390, doc.y, { width: 80, continued: true });
    doc.text("Owner", 470, doc.y, { width: 80 });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(9);

    subscriptions.forEach((s: any) => {
      if (doc.y > 700) doc.addPage();
      doc.text(s.shopName, 40, doc.y, { width: 140, continued: true });
      doc.text(s.planName, 180, doc.y, { width: 60, continued: true });
      doc.text(s.status, 240, doc.y, { width: 70, continued: true });
      doc.text(s.joinDate, 310, doc.y, { width: 80, continued: true });
      doc.text(s.subscriptionExpiry, 390, doc.y, { width: 80, continued: true });
      doc.text(s.ownerName || "Owner", 470, doc.y, { width: 80 });
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /super-admin/subscription-analytics/report/revenue ──────────────────
export const getSubscriptionRevenueReport = async (req: Request, res: Response) => {
  try {
    return getSubscriptionAnalyticsReport(req, res); // Redirect to base report
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /super-admin/subscription-analytics/report/churn ────────────────────
export const getSubscriptionChurnReport = async (req: Request, res: Response) => {
  try {
    return getSubscriptionAnalyticsReport(req, res); // Redirect to base report
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
