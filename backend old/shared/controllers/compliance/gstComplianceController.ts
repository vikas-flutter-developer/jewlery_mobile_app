import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { Invoice as RetailerInvoice, Sale as RetailerSale, TCSTransaction as RetailerTCS, FinancialYear as RetailerFY, Notification as RetailerNotification } from "../../../retailer/models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

function getModels(req: AuthRequest) {
  // Both ADMIN (Manufacturer) and RETAILER share the retailer db for invoices/sales
  return {
    Invoice: RetailerInvoice,
    Sale: RetailerSale,
    TCS: RetailerTCS,
    FinancialYear: RetailerFY,
    Notification: RetailerNotification,
  };
}

// ITC is derived from purchase invoices stored as Invoices with type != 'GST' OR from Sale.tax (purchase GST)
// Since PurchaseOrder only holds gstPercent+total (not absolute GST amounts), we approximate ITC
// from Invoice records where the invoice acts as a purchase receipt (not supported directly).
// Instead, we sum gstBreakup.totalGst across all final invoices as output tax,
// and for ITC we use a configurable 0 until a dedicated purchase invoice model exists.
// NOTE: This is clearly labelled in the API response as estimated.

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

async function sendGstNotification(
  Notification: any,
  tenantId: string,
  type: string,
  title: string,
  message: string,
  severity: "INFO" | "WARNING" | "CRITICAL" = "WARNING"
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-GST-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "Compliance",
        severity,
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[GST Notification] Failed:", err);
  }
}

// ─── GET /api/compliance/gst/dashboard ────────────────────────────────────────

export const getGstDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { Invoice, TCS, FinancialYear } = getModels(req);
    const tenantId = getTenantId(req);
    const { financialYear, branchCode } = req.query;

    const matchStage: any = { status: "final" };
    if (tenantId !== "default-shop") matchStage.tenantId = tenantId;
    if (financialYear) matchStage.financialYear = financialYear;
    if (branchCode) matchStage.branchCode = branchCode;

    // Aggregate output GST from invoices
    const gstAgg = await Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOutputGst: { $sum: "$gstBreakup.totalGst" },
          totalCgst: { $sum: "$gstBreakup.cgstAmount" },
          totalSgst: { $sum: "$gstBreakup.sgstAmount" },
          totalIgst: { $sum: "$gstBreakup.igstAmount" },
          totalTaxableValue: { $sum: "$gstBreakup.taxableValue" },
          totalGrandTotal: { $sum: "$grandTotal" },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    // TCS collected
    const tcsAgg = await TCS.aggregate([
      { $match: tenantId !== "default-shop" ? { tenantId } : {} },
      { $group: { _id: null, totalTcs: { $sum: "$tcsAmount" } } },
    ]);

    // Monthly output GST trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyTrend = await Invoice.aggregate([
      {
        $match: {
          ...matchStage,
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          outputGst: { $sum: "$gstBreakup.totalGst" },
          taxableValue: { $sum: "$gstBreakup.taxableValue" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Current financial year info
    const currentFY = await FinancialYear.findOne({ status: "ACTIVE", isDefault: true }).lean();

    const gstData = gstAgg[0] || {
      totalOutputGst: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalTaxableValue: 0,
      totalGrandTotal: 0,
      invoiceCount: 0,
    };

    const totalTcs = tcsAgg[0]?.totalTcs || 0;
    // ITC is estimated — placeholder since no dedicated purchase invoice model exists
    const estimatedItc = 0;
    const gstLiability = Math.max(0, gstData.totalOutputGst - estimatedItc);

    // HSN liabilities breakdown
    const liabilitiesAgg = await Invoice.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            hsnCode: "$items.hsnCode",
            gstRate: "$items.gstRate"
          },
          taxableValue: { $sum: "$items.taxableValue" },
          gstTax: { $sum: { $add: ["$items.cgstAmount", "$items.sgstAmount", "$items.igstAmount"] } }
        }
      }
    ]);
    const liabilities = liabilitiesAgg.map((l: any) => ({
      hsnCode: l._id.hsnCode || "7113",
      taxRate: l._id.gstRate ?? 3,
      taxableValue: Math.round(l.taxableValue * 100) / 100,
      gstTax: Math.round(l.gstTax * 100) / 100
    }));

    // Find and check exceptions
    const allInvoicesForExceptions = await Invoice.find(matchStage).sort({ createdAt: -1 }).lean();
    const exceptions: any[] = [];
    for (const inv of allInvoicesForExceptions) {
      const issues: string[] = [];
      const storeGstin = inv.storeProfile?.gstin;
      if (!storeGstin || storeGstin.trim() === "") {
        issues.push("MISSING_STORE_GSTIN");
      }
      const taxableValue = inv.gstBreakup?.taxableValue || 0;
      const totalGst = inv.gstBreakup?.totalGst || 0;
      if (taxableValue > 100 && totalGst === 0) {
        issues.push("ZERO_GST_ON_TAXABLE_VALUE");
      }
      if (inv.items && inv.items.length > 0) {
        const lineGstSum = inv.items.reduce((acc: number, item: any) => {
          return acc + (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0);
        }, 0);
        const headerGst = inv.gstBreakup?.totalGst || 0;
        if (Math.abs(lineGstSum - headerGst) > 1) {
          issues.push("GST_AMOUNT_MISMATCH");
        }
      }
      if (!inv.financialYear) {
        issues.push("MISSING_FINANCIAL_YEAR");
      }
      if (issues.length > 0) {
        const readableIssues = issues.map(issue => {
          switch(issue) {
            case "MISSING_STORE_GSTIN": return "Missing store GSTIN configuration.";
            case "INVALID_STORE_GSTIN": return "Store GSTIN formatting is invalid.";
            case "ZERO_GST_ON_TAXABLE_VALUE": return "Taxable sale has 0% GST recorded.";
            case "GST_AMOUNT_MISMATCH": return "GST sum mismatch between header and item lines.";
            case "MISSING_FINANCIAL_YEAR": return "Invoice is missing financial year tag.";
            default: return issue.replace(/_/g, " ");
          }
        }).join(", ");

        exceptions.push({
          invoiceId: inv.invoiceNumber,
          invoiceNumber: inv.invoiceNumber,
          message: readableIssues,
          errorDetails: readableIssues,
          issues,
          status: "OPEN"
        });
      }
    }

    return res.json({
      success: true,
      data: {
        summary: {
          totalSales: Math.round(gstData.totalTaxableValue * 100) / 100,
          taxLiability: Math.round(gstLiability * 100) / 100,
        },
        liabilities,
        exceptions,
        totalGstCollected: Math.round(gstData.totalOutputGst * 100) / 100,
        totalOutputTax: Math.round(gstData.totalOutputGst * 100) / 100,
        cgstCollected: Math.round(gstData.totalCgst * 100) / 100,
        sgstCollected: Math.round(gstData.totalSgst * 100) / 100,
        igstCollected: Math.round(gstData.totalIgst * 100) / 100,
        totalTaxableValue: Math.round(gstData.totalTaxableValue * 100) / 100,
        estimatedItc,
        gstLiability: Math.round(gstLiability * 100) / 100,
        tcsCollected: Math.round(totalTcs * 100) / 100,
        totalInvoices: gstData.invoiceCount,
        currentFinancialYear: currentFY?.name || null,
        monthlyTrend: monthlyTrend.map((m: any) => ({
          year: m._id.year,
          month: m._id.month,
          label: `${m._id.year}-${String(m._id.month).padStart(2, "0")}`,
          outputGst: Math.round(m.outputGst * 100) / 100,
          taxableValue: Math.round(m.taxableValue * 100) / 100,
          invoiceCount: m.invoiceCount,
        })),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/compliance/gst/summary ──────────────────────────────────────────

export const getGstSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { Invoice } = getModels(req);
    const tenantId = getTenantId(req);

    const matchStage: any = { status: "final" };
    if (tenantId !== "default-shop") matchStage.tenantId = tenantId;

    // Group by financial year + branch
    const byFY = await Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { financialYear: "$financialYear", branchCode: "$branchCode" },
          totalOutputGst: { $sum: "$gstBreakup.totalGst" },
          totalCgst: { $sum: "$gstBreakup.cgstAmount" },
          totalSgst: { $sum: "$gstBreakup.sgstAmount" },
          totalIgst: { $sum: "$gstBreakup.igstAmount" },
          totalTaxableValue: { $sum: "$gstBreakup.taxableValue" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.financialYear": -1, "_id.branchCode": 1 } },
    ]);

    return res.json({ success: true, data: byFY });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/compliance/gst/liabilities ──────────────────────────────────────

export const getGstLiabilities = async (req: AuthRequest, res: Response) => {
  try {
    const { Invoice } = getModels(req);
    const tenantId = getTenantId(req);
    const { financialYear, branchCode, startDate, endDate } = req.query;

    const matchStage: any = { status: "final" };
    if (tenantId !== "default-shop") matchStage.tenantId = tenantId;
    if (financialYear) matchStage.financialYear = financialYear;
    if (branchCode) matchStage.branchCode = branchCode;
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate as string);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate as string);
    }

    const monthly = await Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            financialYear: "$financialYear",
          },
          outputGst: { $sum: "$gstBreakup.totalGst" },
          cgst: { $sum: "$gstBreakup.cgstAmount" },
          sgst: { $sum: "$gstBreakup.sgstAmount" },
          igst: { $sum: "$gstBreakup.igstAmount" },
          taxableValue: { $sum: "$gstBreakup.taxableValue" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const liabilities = monthly.map((m: any) => ({
      year: m._id.year,
      month: m._id.month,
      financialYear: m._id.financialYear,
      label: `${m._id.year}-${String(m._id.month).padStart(2, "0")}`,
      outputGst: Math.round(m.outputGst * 100) / 100,
      cgst: Math.round(m.cgst * 100) / 100,
      sgst: Math.round(m.sgst * 100) / 100,
      igst: Math.round(m.igst * 100) / 100,
      taxableValue: Math.round(m.taxableValue * 100) / 100,
      estimatedItc: 0, // pending dedicated purchase invoice collection
      netLiability: Math.round(m.outputGst * 100) / 100,
      invoiceCount: m.invoiceCount,
    }));

    return res.json({ success: true, data: liabilities });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/compliance/gst/exceptions ───────────────────────────────────────

export const getGstExceptions = async (req: AuthRequest, res: Response) => {
  try {
    const { Invoice, Notification } = getModels(req);
    const tenantId = getTenantId(req);
    const { page = 1, limit = 20, financialYear, branchCode } = req.query;

    const matchStage: any = { status: "final" };
    if (tenantId !== "default-shop") matchStage.tenantId = tenantId;
    if (financialYear) matchStage.financialYear = financialYear;
    if (branchCode) matchStage.branchCode = branchCode;

    const skip = (Number(page) - 1) * Number(limit);
    const invoices = await Invoice.find(matchStage)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit) * 5) // Fetch more to filter
      .lean();

    const exceptions: any[] = [];
    const missingGstinNotificationSent = new Set<string>();

    for (const inv of invoices) {
      const issues: string[] = [];

      // 1. Missing store GSTIN
      const storeGstin = inv.storeProfile?.gstin;
      if (!storeGstin || storeGstin.trim() === "") {
        issues.push("MISSING_STORE_GSTIN");
      } else if (!GSTIN_REGEX.test(storeGstin.trim())) {
        issues.push("INVALID_STORE_GSTIN");
      }

      // 2. Zero GST on non-zero taxable value
      const taxableValue = inv.gstBreakup?.taxableValue || 0;
      const totalGst = inv.gstBreakup?.totalGst || 0;
      if (taxableValue > 100 && totalGst === 0) {
        issues.push("ZERO_GST_ON_TAXABLE_VALUE");
      }

      // 3. GST mismatch — header totalGst vs sum of line items
      if (inv.items && inv.items.length > 0) {
        const lineGstSum = inv.items.reduce((acc: number, item: any) => {
          return acc + (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0);
        }, 0);
        const headerGst = inv.gstBreakup?.totalGst || 0;
        if (Math.abs(lineGstSum - headerGst) > 1) {
          issues.push("GST_AMOUNT_MISMATCH");
        }
      }

      // 4. Missing financial year tagging
      if (!inv.financialYear) {
        issues.push("MISSING_FINANCIAL_YEAR");
      }

      if (issues.length > 0) {
        // Fire notification for store GSTIN missing (once per unique store GSTIN issue)
        const storeKey = `${tenantId}-store-gstin`;
        if (issues.includes("MISSING_STORE_GSTIN") && !missingGstinNotificationSent.has(storeKey)) {
          missingGstinNotificationSent.add(storeKey);
          await sendGstNotification(
            Notification,
            tenantId,
            "GST_COMPLIANCE",
            "Missing Store GSTIN",
            `Invoice ${inv.invoiceNumber} does not have a store GSTIN. Configure it in Settings → Invoice Profile.`,
            "CRITICAL"
          );
        }

        exceptions.push({
          invoiceId: inv._id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.createdAt,
          financialYear: inv.financialYear,
          branchCode: inv.branchCode,
          customerName: inv.customerInfo?.name || "Walk-in",
          customerGstin: inv.customerInfo?.gstin || null,
          storeGstin: inv.storeProfile?.gstin || null,
          grandTotal: inv.grandTotal,
          taxableValue: inv.gstBreakup?.taxableValue || 0,
          totalGst: inv.gstBreakup?.totalGst || 0,
          issues,
          status: "OPEN",
        });
      }

      if (exceptions.length >= Number(limit)) break;
    }

    return res.json({
      success: true,
      data: exceptions,
      total: exceptions.length,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/compliance/gst/filing-status ────────────────────────────────────

export const getGstFilingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { Invoice, FinancialYear } = getModels(req);
    const tenantId = getTenantId(req);

    const financialYears = await FinancialYear.find().sort({ startDate: -1 }).lean();

    const result = await Promise.all(
      financialYears.map(async (fy: any) => {
        const matchStage: any = { status: "final", financialYear: fy.code };
        if (tenantId !== "default-shop") matchStage.tenantId = tenantId;

        const agg = await Invoice.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              totalGst: { $sum: "$gstBreakup.totalGst" },
              totalTaxableValue: { $sum: "$gstBreakup.taxableValue" },
              totalGrandTotal: { $sum: "$grandTotal" },
            },
          },
        ]);

        const data = agg[0] || { totalInvoices: 0, totalGst: 0, totalTaxableValue: 0, totalGrandTotal: 0 };

        // Derive filing status from FY status
        let filingStatus = "PENDING";
        if (fy.status === "CLOSED") filingStatus = "FILED";
        else if (fy.status === "ACTIVE") {
          const now = new Date();
          const endDate = new Date(fy.endDate);
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) filingStatus = "OVERDUE";
          else if (daysRemaining <= 30) filingStatus = "DUE_SOON";
          else filingStatus = "ACTIVE";
        } else {
          filingStatus = "UPCOMING";
        }

        return {
          financialYearId: fy._id,
          financialYear: fy.code,
          financialYearName: fy.name,
          fyStatus: fy.status,
          filingStatus,
          startDate: fy.startDate,
          endDate: fy.endDate,
          totalInvoices: data.totalInvoices,
          totalGst: Math.round(data.totalGst * 100) / 100,
          totalTaxableValue: Math.round(data.totalTaxableValue * 100) / 100,
          totalGrandTotal: Math.round(data.totalGrandTotal * 100) / 100,
        };
      })
    );

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
