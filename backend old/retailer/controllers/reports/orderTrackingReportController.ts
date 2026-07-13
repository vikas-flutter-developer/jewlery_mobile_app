import { Request, Response } from "express";
import { Order, OrderTracking } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

/**
 * GET /api/reports/order-tracking
 * Filters: startDate, endDate, orderType (custom / standard), status
 */
export const getOrderTrackingReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, orderType, status, format } = req.query;

    let query: any = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    if (status) {
      query.trackingStatus = status;
    }

    let trackings: any[] = [];
    if (isDbConnected()) {
      trackings = await OrderTracking.find(query).populate("orderId").lean();
    } else {
      // Mock Fallback
      trackings = [
        {
          trackingCode: "TRKMOCK123",
          trackingStatus: status || "IN_PRODUCTION",
          expiresAt: new Date(Date.now() + 864000000),
          isActive: true,
          createdAt: new Date(),
          orderId: {
            _id: "order_mock_999",
            isCustom: orderType === "custom" ? true : false,
            customerName: "Ammar Client",
            sellingPrice: 150000,
            neededDate: "2026-07-20"
          }
        }
      ];
    }

    // Apply order type filter post-query if database populated or fallback populated
    if (orderType) {
      const isCustomVal = orderType === "custom";
      trackings = trackings.filter(t => t.orderId && !!t.orderId.isCustom === isCustomVal);
    }

    // ── Excel Export ──────────────────────────────────────────────────────────
    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Order Tracking Report");

      worksheet.columns = [
        { header: "Tracking Code", key: "code", width: 20 },
        { header: "Order ID", key: "orderId", width: 30 },
        { header: "Customer Name", key: "customer", width: 25 },
        { header: "Order Type", key: "type", width: 15 },
        { header: "Current Tracking Status", key: "status", width: 25 },
        { header: "Link Expiration Date", key: "expiry", width: 20 },
        { header: "Is Active", key: "active", width: 12 },
      ];

      trackings.forEach(t => {
        worksheet.addRow({
          code: t.trackingCode,
          orderId: t.orderId?._id?.toString() || "N/A",
          customer: t.orderId?.customerName || "N/A",
          type: t.orderId?.isCustom ? "Custom" : "Standard",
          status: t.trackingStatus,
          expiry: t.expiresAt ? new Date(t.expiresAt).toISOString().split("T")[0] : "N/A",
          active: t.isActive ? "Yes" : "No",
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=order_tracking_report.xlsx");
      await workbook.xlsx.write(res);
      return res.end();
    }

    // ── PDF Export ────────────────────────────────────────────────────────────
    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=order_tracking_report.pdf");
      doc.pipe(res);

      doc.font("Helvetica-Bold").fontSize(18).text("AURAJEWEL - ORDER TRACKING SYSTEM REPORT", { align: "center" });
      doc.fontSize(10).font("Helvetica").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(2);

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Tracking Code", 40, doc.y, { width: 120, continued: true });
      doc.text("Customer", 160, doc.y, { width: 120, continued: true });
      doc.text("Type", 280, doc.y, { width: 80, continued: true });
      doc.text("Status", 360, doc.y, { width: 120, continued: true });
      doc.text("Active", 480, doc.y, { width: 60 });
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(9);

      trackings.forEach(t => {
        if (doc.y > 700) doc.addPage();
        doc.text(t.trackingCode, 40, doc.y, { width: 120, continued: true });
        doc.text(t.orderId?.customerName || "N/A", 160, doc.y, { width: 120, continued: true });
        doc.text(t.orderId?.isCustom ? "Custom" : "Standard", 280, doc.y, { width: 80, continued: true });
        doc.text(t.trackingStatus, 360, doc.y, { width: 120, continued: true });
        doc.text(t.isActive ? "Yes" : "No", 480, doc.y, { width: 60 });
        doc.moveDown(0.5);
      });

      doc.end();
      return;
    }

    // Default JSON response
    return res.json({ success: true, data: trackings });
  } catch (error: any) {
    console.error("Order tracking report error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
