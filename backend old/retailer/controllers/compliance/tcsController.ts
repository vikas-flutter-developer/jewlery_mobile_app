import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { TCSTransaction, Notification } from "../../models/index.js";
import { financeAuditService, buildAuditContextFromRequest } from "../../services/financial/financeAuditService.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { getCurrentFinancialYear } from "../../services/invoice/invoiceNumberService.js";

const TCS_RATE = 0.01; // 1%
const TCS_THRESHOLD = 200000; // 2L

function getTenantId(req: AuthRequest): string {
  return req.user?.tenantId || "default-shop";
}

async function sendTcsNotification(
  tenantId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-TCS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        tenantId,
        type,
        title,
        message,
        category: "Compliance",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[TCS Notification] Failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tcs/calculate
// ─────────────────────────────────────────────────────────────────────────────
export const calculateTcsEndpoint = async (req: AuthRequest, res: Response) => {
  try {
    const { taxableAmount, customerId } = req.body;

    if (taxableAmount === undefined || taxableAmount === null) {
      return res.status(400).json({ success: false, error: "Missing taxableAmount." });
    }

    const amt = Number(taxableAmount);
    if (isNaN(amt) || amt < 0) {
      return res.status(400).json({ success: false, error: "Invalid taxableAmount." });
    }

    const isApplicable = amt >= TCS_THRESHOLD;
    const tcsAmount = isApplicable ? Math.round(amt * TCS_RATE * 100) / 100 : 0;

    return res.status(200).json({
      success: true,
      applicable: isApplicable,
      threshold: TCS_THRESHOLD,
      tcsRate: TCS_RATE,
      tcsAmount,
      taxableAmount: amt,
      customerId: customerId || undefined,
    });
  } catch (err: any) {
    console.error("[TCS] calculateTcsEndpoint error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tcs/transactions
// ─────────────────────────────────────────────────────────────────────────────
export const getTcsTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { customerId, financialYearId, status, startDate, endDate, search, page = 1, limit = 50 } = req.query;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const query: any = { tenantId };

    if (customerId) query.customerId = customerId;
    if (financialYearId) query.financialYearId = financialYearId;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate as string);
      if (endDate) query.transactionDate.$lte = new Date(endDate as string);
    }

    if (search) {
      // Search by invoice ID
      query.invoiceId = { $regex: search, $options: "i" };
    }

    const p = Math.max(1, Number(page));
    const lim = Math.max(1, Number(limit));

    const total = await TCSTransaction.countDocuments(query);
    const list = await TCSTransaction.find(query)
      .sort({ transactionDate: -1 })
      .skip((p - 1) * lim)
      .limit(lim);

    return res.status(200).json({
      success: true,
      total,
      page: p,
      limit: lim,
      data: list,
    });
  } catch (err: any) {
    console.error("[TCS] getTcsTransactions error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tcs/summary
// ─────────────────────────────────────────────────────────────────────────────
export const getTcsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { financialYearId } = req.query;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const activeFy = financialYearId || (await getCurrentFinancialYear());

    // Aggregate values
    const query: any = { tenantId };
    if (activeFy) query.financialYearId = activeFy;

    const allTransactions = await TCSTransaction.find(query);

    let totalCollected = 0;
    let pendingTcs = 0;
    let reportedTcs = 0;

    allTransactions.forEach((tx) => {
      if (tx.status === "COLLECTED") {
        totalCollected += tx.tcsAmount;
      } else if (tx.status === "PENDING") {
        pendingTcs += tx.tcsAmount;
      } else if (tx.status === "REPORTED") {
        reportedTcs += tx.tcsAmount;
      }
    });

    return res.status(200).json({
      success: true,
      financialYear: activeFy,
      totalTcs: totalCollected + pendingTcs + reportedTcs,
      collectedTcs: totalCollected,
      pendingTcs,
      reportedTcs,
    });
  } catch (err: any) {
    console.error("[TCS] getTcsSummary error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tcs/customer/:customerId
// ─────────────────────────────────────────────────────────────────────────────
export const getTcsCustomerSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { customerId } = req.params;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const txs = await TCSTransaction.find({ tenantId, customerId }).sort({ transactionDate: -1 });

    const fySummary: Record<string, { totalTaxable: number; totalTcs: number; collected: number; pending: number }> = {};

    let grandTotalTcs = 0;

    txs.forEach((tx) => {
      const fy = tx.financialYearId;
      if (!fySummary[fy]) {
        fySummary[fy] = { totalTaxable: 0, totalTcs: 0, collected: 0, pending: 0 };
      }
      fySummary[fy].totalTaxable += tx.taxableAmount;
      fySummary[fy].totalTcs += tx.tcsAmount;
      if (tx.status === "COLLECTED" || tx.status === "REPORTED") {
        fySummary[fy].collected += tx.tcsAmount;
      } else {
        fySummary[fy].pending += tx.tcsAmount;
      }
      grandTotalTcs += tx.tcsAmount;
    });

    return res.status(200).json({
      success: true,
      customerId,
      grandTotalTcs,
      financialYears: fySummary,
      transactions: txs,
    });
  } catch (err: any) {
    console.error("[TCS] getTcsCustomerSummary error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tcs/transactions/:id
// ─────────────────────────────────────────────────────────────────────────────
export const updateTcsStatus = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status || !["PENDING", "COLLECTED", "REPORTED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid or missing status." });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const tx = await TCSTransaction.findOne({ _id: id, tenantId });
    if (!tx) {
      return res.status(404).json({ success: false, error: "TCS transaction record not found." });
    }

    const previousData = tx.toObject();
    tx.status = status;
    if (remarks !== undefined) tx.remarks = remarks;
    await tx.save();

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "TCS_UPDATED",
      entityType: "TCS_TRANSACTION",
      entityId: String(tx._id),
      context: auditCtx,
      previousData,
      newData: tx.toObject()
    });

    await sendTcsNotification(
      tenantId,
      "TCS_UPDATED",
      "TCS Status Updated",
      `TCS transaction for invoice ${tx.invoiceId} updated to ${status}.`
    );

    return res.status(200).json({ success: true, data: tx });
  } catch (err: any) {
    console.error("[TCS] updateTcsStatus error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reports Endpoints
// ─────────────────────────────────────────────────────────────────────────────
export const getTcsReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { financialYearId, customerId, startDate, endDate } = req.query;

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: "Database unavailable." });
    }

    const query: any = { tenantId };
    if (financialYearId) query.financialYearId = financialYearId;
    if (customerId) query.customerId = customerId;
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate as string);
      if (endDate) query.transactionDate.$lte = new Date(endDate as string);
    }

    const list = await TCSTransaction.find(query).sort({ transactionDate: 1 });

    const auditCtx = buildAuditContextFromRequest(req);
    await financeAuditService.log({
      actionType: "TCS_REPORT_GENERATED",
      entityType: "TCS_TRANSACTION",
      entityId: "REPORT-RUN",
      context: auditCtx,
      newData: { count: list.length }
    });

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      filters: { financialYearId, customerId, startDate, endDate },
      data: list,
    });
  } catch (err: any) {
    console.error("[TCS] getTcsReport error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};
