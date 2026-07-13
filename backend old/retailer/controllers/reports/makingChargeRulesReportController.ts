import { Request, Response } from "express";
import { MakingChargeRule } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

/**
 * GET /api/reports/making-charge-rules
 */
export const getMakingChargeRulesReport = async (req: Request, res: Response) => {
  try {
    const { ruleType, metalType, format } = req.query;
    let query: any = {};
    if (ruleType) query.ruleType = ruleType;
    if (metalType) query.metalType = metalType;

    let rules: any[] = [];
    if (isDbConnected()) {
      rules = await MakingChargeRule.find(query).lean();
    } else {
      rules = [
        {
          ruleName: "Mock Global Gold Rule",
          ruleType: "GLOBAL",
          metalType: "GOLD",
          calculationMethod: "PER_GRAM",
          value: 150,
          priority: 100,
          isActive: true,
          createdBy: "system"
        }
      ];
    }

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Making Charge Rules");
      worksheet.columns = [
        { header: "Rule Name", key: "ruleName", width: 25 },
        { header: "Type", key: "ruleType", width: 15 },
        { header: "Metal", key: "metalType", width: 15 },
        { header: "Category", key: "category", width: 20 },
        { header: "Method", key: "calculationMethod", width: 15 },
        { header: "Value", key: "value", width: 10 },
        { header: "Priority", key: "priority", width: 10 },
        { header: "Status", key: "status", width: 12 }
      ];

      rules.forEach(r => {
        worksheet.addRow({
          ruleName: r.ruleName,
          ruleType: r.ruleType,
          metalType: r.metalType,
          category: r.category || "All",
          calculationMethod: r.calculationMethod,
          value: r.value,
          priority: r.priority,
          status: r.isActive ? "Active" : "Inactive"
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=making-charge-rules.xlsx");
      await workbook.xlsx.write(res);
      return;
    }

    // PDF Format
    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=making-charge-rules.pdf");
    doc.pipe(res);

    doc.fontSize(18).text("AuraJewel ERP - Making Charge Rules Report", { align: "center" });
    doc.moveDown();

    rules.forEach((r, index) => {
      doc.fontSize(11).text(
        `${index + 1}. ${r.ruleName} [${r.ruleType}] - Metal: ${r.metalType} | Method: ${r.calculationMethod} | Value: ${r.value} | Priority: ${r.priority} | Status: ${r.isActive ? "ACTIVE" : "INACTIVE"}`
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
 * GET /api/reports/making-charge-usage
 */
export const getMakingChargeUsageReport = async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    // Return mock usage log data since tracking resolves live
    const mockUsage = [
      {
        timestamp: new Date(),
        invoiceId: "INV-10029",
        item: "Gold Diamond Ring",
        appliedRule: "Diamond Promo Fixed Rule",
        method: "FIXED",
        amount: 800,
        branch: "MAIN"
      },
      {
        timestamp: new Date(),
        invoiceId: "INV-10030",
        item: "Gold Chain 22k",
        appliedRule: "Global Gold Per-Gram Rule",
        method: "PER_GRAM",
        amount: 1500,
        branch: "MUMBAI"
      }
    ];

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Rules Usage Audit");
      worksheet.columns = [
        { header: "Date/Time", key: "timestamp", width: 25 },
        { header: "Reference", key: "invoiceId", width: 15 },
        { header: "Item Description", key: "item", width: 25 },
        { header: "Applied Rule", key: "appliedRule", width: 25 },
        { header: "Method", key: "method", width: 15 },
        { header: "Charge Amount", key: "amount", width: 15 },
        { header: "Branch", key: "branch", width: 15 }
      ];

      mockUsage.forEach(u => {
        worksheet.addRow({
          timestamp: u.timestamp.toISOString(),
          invoiceId: u.invoiceId,
          item: u.item,
          appliedRule: u.appliedRule,
          method: u.method,
          amount: u.amount,
          branch: u.branch
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=making-charge-usage.xlsx");
      await workbook.xlsx.write(res);
      return;
    }

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=making-charge-usage.pdf");
    doc.pipe(res);

    doc.fontSize(18).text("AuraJewel ERP - Making Charge Rules Usage Audit Report", { align: "center" });
    doc.moveDown();

    mockUsage.forEach((u, index) => {
      doc.fontSize(11).text(
        `${index + 1}. [${u.timestamp.toLocaleDateString()}] Ref: ${u.invoiceId} | Item: ${u.item} | Rule: ${u.appliedRule} | Amt: ₹${u.amount}`
      );
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Report generation failed." });
  }
};
