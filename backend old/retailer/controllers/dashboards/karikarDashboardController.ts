import { Request, Response } from "express";
import { authMiddleware, roleMiddleware } from "../../../lib/authUtils.js";

import { Karikar, Sale } from "../../models/index.js";
import {
  listAllWastageReconciliations,
  getAllWastageReconciliationSummary,
  approveKarikarWastageReconciliation,
  rejectKarikarWastageReconciliation,
} from "../../../karikar/services/wastageReconciliationService.js";
import {
  listAllKarikarWageLedgers,
  getAllKarikarWageLedgerSummary,
  approveKarikarWageLedger as approveKarikarWageLedgerService,
  rejectKarikarWageLedger as rejectKarikarWageLedgerService,
  payKarikarWageLedger as payKarikarWageLedgerService,
} from "../../../karikar/services/karikarWageLedgerService.js";

export const getKarikarDashboard = async (_req: Request, res: Response) => {
  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch karikar metrics
    const [
      totalKarikars,
      activeKarikars,
      totalJobsAssigned,
      completedToday,
      pendingJobs,
      totalEarnings,
    ] = await Promise.all([
      Karikar.countDocuments(),
      Karikar.countDocuments({ status: "active" }),
      Sale.countDocuments({ assignedTo: { $exists: true } }),
      Sale.countDocuments({
        assignedTo: { $exists: true },
        status: "completed",
        completedAt: { $gte: today, $lt: tomorrow },
      }),
      Sale.countDocuments({
        assignedTo: { $exists: true },
        status: "pending",
      }),
      Sale.aggregate([
        {
          $match: { assignedTo: { $exists: true } },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$laborCharges" },
          },
        },
      ]),
    ]);

    // Get top performing karikars
    const topKarikars = await Karikar.find({ status: "ACTIVE" })
      .sort({ performanceRating: -1 })
      .limit(5)
      .lean();

    // Get recent assignments
    const recentJobs = await Sale.find({ assignedTo: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        summary: {
          totalKarikars,
          activeKarikars,
          totalJobsAssigned,
          completedToday,
          pendingJobs,
          totalEarnings: totalEarnings[0]?.total || 0,
        },
        topKarikars,
        recentJobs,
        dailyStats: {
          jobsCompleted: completedToday,
          jobsPending: pendingJobs,
          averageCompletionTime: "2.5 hours",
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching dashboard data",
    });
  }
};

const parseQueryDate = (value: unknown) => {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const buildKarikarReturnRecords = async (filters?: {
  karikarId?: string;
  status?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
}) => {
  const karikars = await Karikar.find().lean();
  const returns = karikars.flatMap((karikar: any) => {
    const records = Array.isArray(karikar.metalReturns) ? karikar.metalReturns : [];
    return records.map((record: any) => {
      const createdAt = record.createdAt ? new Date(record.createdAt) : new Date(record.requestedAt || record.returnedAt || Date.now());
      return {
        ...record,
        karikarId: String(karikar._id),
        karikarName: karikar.name || "",
        karikarEmail: karikar.email || "",
        karikarStatus: karikar.status || "",
        createdAt,
      };
    });
  });

  if (!filters) {
    return returns;
  }

  return returns.filter((record: any) => {
    if (filters.karikarId && String(record.karikarId) !== filters.karikarId) return false;
    if (filters.status && String(record.status || "").toUpperCase() !== filters.status.toUpperCase()) return false;
    if (filters.fromDate && record.createdAt < filters.fromDate) return false;
    if (filters.toDate && record.createdAt > filters.toDate) return false;
    return true;
  });
};

export const getKarikarManagement = async (_req: Request, res: Response) => {
  try {
    const karikars = await Karikar.find().lean();
    
    // Add performance metrics
    const karikarsWithMetrics = await Promise.all(
      karikars.map(async (karikar: any) => {
        const jobsCompleted = await Sale.countDocuments({
          assignedTo: karikar._id,
          status: "completed",
        });
        return {
          ...karikar,
          jobsCompleted,
        };
      })
    );

    res.json({
      success: true,
      data: karikarsWithMetrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching karikars",
    });
  }
};

export const getKarikarReturns = async (req: Request, res: Response) => {
  try {
    const requestedKarikarId = String(req.params.karikarId || req.query.karikarId || "").trim() || undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const fromDate = parseQueryDate(req.query.fromDate);
    const toDate = parseQueryDate(req.query.toDate);

    const returns = await buildKarikarReturnRecords({
      karikarId: requestedKarikarId,
      status,
      fromDate,
      toDate,
    });

    const sorted = returns.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.status(200).json({ success: true, data: sorted });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching karikar returns",
    });
  }
};

export const getKarikarReturnSummary = async (req: Request, res: Response) => {
  console.log('[DEBUG] getKarikarReturnSummary start');
  try {
    const requestedKarikarId = String(req.query.karikarId || "").trim() || undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const fromDate = parseQueryDate(req.query.fromDate);
    const toDate = parseQueryDate(req.query.toDate);

    const returns = await buildKarikarReturnRecords({
      karikarId: requestedKarikarId,
      status,
      fromDate,
      toDate,
    });

    const karikars = await Karikar.find().lean();
    const totalGoldStock = karikars.reduce((sum: number, karikar: any) => sum + Number(karikar.goldStock || 0), 0);
    const topKarikarsByWeight = returns.reduce((map: Record<string, any>, record: any) => {
      const key = record.karikarId;
      map[key] = map[key] || { karikarId: record.karikarId, karikarName: record.karikarName, totalWeight: 0, returnCount: 0 };
      map[key].totalWeight += Number(record.weight || 0);
      map[key].returnCount += 1;
      return map;
    }, {} as Record<string, any>);

    const topKarikarList = Object.values(topKarikarsByWeight)
      .sort((a: any, b: any) => b.totalWeight - a.totalWeight)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        totalReturns: returns.length,
        totalReturnedWeight: returns.reduce((sum: number, item: any) => sum + Number(item.weight || 0), 0),
        pendingCount: returns.filter((item: any) => String(item.status || "").toUpperCase() === "PENDING").length,
        approvedCount: returns.filter((item: any) => String(item.status || "").toUpperCase() === "APPROVED").length,
        completedCount: returns.filter((item: any) => String(item.status || "").toUpperCase() === "COMPLETED").length,
        distinctKarikars: Array.from(new Set(returns.map((item: any) => item.karikarId))).length,
        totalGoldStock,
        topKarikarsByWeight: topKarikarList,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching karikar return summary",
    });
  }
};

export const assignJobToKarikar = async (req: Request, res: Response) => {
  try {
    const { saleId, karikarId, laborCharges } = req.body;

    const sale = await Sale.findByIdAndUpdate(
      saleId,
      {
        assignedTo: karikarId,
        laborCharges,
        status: "assigned",
      },
      { new: true }
    );

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error assigning job",
    });
  }
};

export const listKarikarWastageReconciliations = async (req: Request, res: Response) => {
  try {
    const requestedKarikarId = String(req.query.karikarId || req.params.karikarId || "").trim() || undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const fromDate = parseQueryDate(req.query.fromDate);
    const toDate = parseQueryDate(req.query.toDate);

    const records = await listAllWastageReconciliations({
      karikarId: requestedKarikarId,
      status,
      fromDate,
      toDate,
    });

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load wastage reconciliations",
    });
  }
};

export const getWastageReconciliationSummary = async (req: Request, res: Response) => {
  try {
    const requestedKarikarId = String(req.query.karikarId || req.params.karikarId || "").trim() || undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const fromDate = parseQueryDate(req.query.fromDate);
    const toDate = parseQueryDate(req.query.toDate);

    const summary = await getAllWastageReconciliationSummary({
      karikarId: requestedKarikarId,
      status,
      fromDate,
      toDate,
    });

    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load wastage reconciliation summary",
    });
  }
};

export const approveWastageReconciliation = async (req: Request, res: Response) => {
  try {
    const reconciliationId = String(req.params.reconciliationId || "");
    const approverId = String(req.body.approverId || req.body.userId || "system");
    const actualWastage = req.body.actualWastage;
    const calculatedLoss = req.body.calculatedLoss;
    const notes = req.body.notes;

    const result = await approveKarikarWastageReconciliation(reconciliationId, approverId, {
      actualWastage,
      calculatedLoss,
      notes,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve wastage reconciliation",
    });
  }
};

export const rejectWastageReconciliation = async (req: Request, res: Response) => {
  try {
    const reconciliationId = String(req.params.reconciliationId || "");
    const approverId = String(req.body.approverId || req.body.userId || "system");
    const rejectionReason = String(req.body.rejectionReason || req.body.reason || "No reason provided");

    const result = await rejectKarikarWastageReconciliation(reconciliationId, approverId, rejectionReason);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject wastage reconciliation",
    });
  }
};

export const listKarikarWageLedgers = async (req: Request, res: Response) => {
  try {
    const requestedKarikarId = String(req.query.karikarId || req.params.karikarId || "").trim() || undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const fromDate = parseQueryDate(req.query.fromDate);
    const toDate = parseQueryDate(req.query.toDate);

    const records = await listAllKarikarWageLedgers({
      karikarId: requestedKarikarId,
      status,
      fromDate,
      toDate,
    });

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load wage ledgers",
    });
  }
};

export const getKarikarWageLedgerSummary = async (req: Request, res: Response) => {
  try {
    const requestedKarikarId = String(req.query.karikarId || req.params.karikarId || "").trim() || undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const fromDate = parseQueryDate(req.query.fromDate);
    const toDate = parseQueryDate(req.query.toDate);

    const summary = await getAllKarikarWageLedgerSummary({
      karikarId: requestedKarikarId,
      status,
      fromDate,
      toDate,
    });

    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load wage ledger summary",
    });
  }
};

export const approveKarikarWageLedger = async (req: Request, res: Response) => {
  try {
    const wageLedgerId = String(req.params.ledgerId || "");
    const approverId = String(req.body.approverId || req.body.userId || "system");
    const adminNotes = String(req.body.adminNotes || req.body.notes || "");

    const result = await approveKarikarWageLedgerService(wageLedgerId, approverId, { adminNotes });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve wage ledger",
    });
  }
};

export const rejectKarikarWageLedger = async (req: Request, res: Response) => {
  try {
    const wageLedgerId = String(req.params.ledgerId || "");
    const approverId = String(req.body.approverId || req.body.userId || "system");
    const rejectionReason = String(req.body.rejectionReason || req.body.reason || "No reason provided");

    const result = await rejectKarikarWageLedgerService(wageLedgerId, approverId, rejectionReason);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to reject wage ledger",
    });
  }
};

export const payKarikarWageLedger = async (req: Request, res: Response) => {
  try {
    const wageLedgerId = String(req.params.ledgerId || "");
    const payerId = String(req.body.payerId || req.body.userId || "system");
    const payload = req.body || {};

    const result = await payKarikarWageLedgerService(wageLedgerId, payerId, payload);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to pay wage ledger",
    });
  }
};

export const updateKarikarStatus = async (req: Request, res: Response) => {
  try {
    const { karikarId } = req.params;
    const { status } = req.body;

    const karikar = await Karikar.findByIdAndUpdate(
      karikarId,
      { status },
      { new: true }
    );

    res.json({
      success: true,
      data: karikar,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error updating karikar",
    });
  }
};


