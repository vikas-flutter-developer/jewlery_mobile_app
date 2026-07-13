import { Request, Response } from "express";
import { FinancialYear } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

/**
 * GET /api/reports/financial-years
 */
export const getFinancialYearsReport = async (req: Request, res: Response) => {
  try {
    const { status, format } = req.query;
    let query: any = {};
    if (status) query.status = status;

    let list: any[] = [];
    if (isDbConnected()) {
      list = await FinancialYear.find(query).sort({ startDate: -1 }).lean();
    } else {
      list = [
        {
          name: "FY 2026-27",
          code: "2026-27",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          status: "ACTIVE",
          isDefault: true,
          remarks: "Mock year"
        }
      ];
    }

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Financial Years");
      worksheet.columns = [
        { header: "Year Name", key: "name", width: 25 },
        { header: "Code", key: "code", width: 15 },
        { header: "Start Date", key: "startDate", width: 15 },
        { header: "End Date", key: "endDate", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Default Active", key: "isDefault", width: 15 }
      ];

      list.forEach(y => {
        worksheet.addRow({
          name: y.name,
          code: y.code,
          startDate: new Date(y.startDate).toISOString().slice(0, 10),
          endDate: new Date(y.endDate).toISOString().slice(0, 10),
          status: y.status,
          isDefault: y.isDefault ? "Yes" : "No"
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=financial-years-report.xlsx");
      await workbook.xlsx.write(res);
      return;
    }

    // PDF Format
    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=financial-years-report.pdf");
    doc.pipe(res);

    doc.fontSize(18).text("AuraJewel ERP - Financial Years Directory Report", { align: "center" });
    doc.moveDown();

    list.forEach((y, index) => {
      doc.fontSize(11).text(
        `${index + 1}. ${y.name} (${y.code}) | Period: ${new Date(y.startDate).toLocaleDateString()} - ${new Date(y.endDate).toLocaleDateString()} | Status: ${y.status} ${y.isDefault ? "[ACTIVE]" : ""}`
      );
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Report generation failed." });
  }
};

/**
 * GET /api/reports/year-closing
 */
export const getYearClosingReport = async (req: Request, res: Response) => {
  try {
    const { format } = req.query;

    let closedYears: any[] = [];
    if (isDbConnected()) {
      closedYears = await FinancialYear.find({ status: "CLOSED" }).sort({ closedAt: -1 }).lean();
    } else {
      closedYears = [
        {
          name: "FY 2025-26",
          code: "2025-26",
          closedAt: new Date("2026-03-31T23:59:59Z"),
          closedBy: "admin@aurajewel.com",
          remarks: "Successfully completed audit."
        }
      ];
    }

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Year Closings Audit");
      worksheet.columns = [
        { header: "FY Code", key: "code", width: 15 },
        { header: "FY Name", key: "name", width: 25 },
        { header: "Closed At", key: "closedAt", width: 25 },
        { header: "Closed By", key: "closedBy", width: 25 },
        { header: "Audit Remarks", key: "remarks", width: 35 }
      ];

      closedYears.forEach(y => {
        worksheet.addRow({
          code: y.code,
          name: y.name,
          closedAt: y.closedAt ? new Date(y.closedAt).toISOString() : "N/A",
          closedBy: y.closedBy || "System",
          remarks: y.remarks || "Checked. No pending transactions."
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=year-closings.xlsx");
      await workbook.xlsx.write(res);
      return;
    }

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=year-closings.pdf");
    doc.pipe(res);

    doc.fontSize(18).text("AuraJewel ERP - Year Closing Audit Trail Report", { align: "center" });
    doc.moveDown();

    closedYears.forEach((y, index) => {
      doc.fontSize(11).text(
        `${index + 1}. FY Name: ${y.name} (${y.code}) | Closed At: ${y.closedAt ? new Date(y.closedAt).toLocaleString() : "N/A"} | Closed By: ${y.closedBy || "N/A"} | Audit Remarks: ${y.remarks || "None"}`
      );
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Report generation failed." });
  }
};
