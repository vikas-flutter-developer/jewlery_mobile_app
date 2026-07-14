import { Request, Response } from "express";
import mongoose from "mongoose";
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

const logAnalyticsAccess = async (actor: string, action: string, details: string) => {
  try {
    if (getDbReady()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "SubscriptionAnalytics",
        entityId: "subscription-analytics",
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write subscription analytics audit log:", err);
  }
};

// ─── GET /api/admin/subscription-analytics/dashboard ─────────────────────────
export const getSubscriptionDashboard = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-dashboard", "Accessed Subscription Analytics Dashboard metrics");

    if (!getDbReady()) {
      return res.status(200).json({
        success: true,
        data: { totalSubscribers: 0, activeSubs: 0, expiredSubs: 0, trialAccounts: 0, mrr: 0, arr: 0, churnRate: 0, renewalRate: 100 }
      });
    }

    const stores = await Subscription.find({}).lean();
    const totalSubscribers = stores.length;
    const activeSubs = stores.filter((s: any) => s.status === "ACTIVE").length;
    const expiredSubs = stores.filter((s: any) => s.status === "EXPIRED" || s.status === "SUSPENDED").length;
    const trialAccounts = stores.filter((s: any) => s.status === "TRIAL").length;

    // Churn Rate
    const churned = stores.filter((s: any) => s.status === "SUSPENDED" || s.status === "EXPIRED").length;
    const churnRate = totalSubscribers > 0 ? (churned / totalSubscribers) * 100 : 0;

    // MRR / ARR Calculations
    let mrr = 0;
    stores.forEach((s: any) => {
      if (s.status === "ACTIVE" || s.status === "TRIAL") {
        const plan = String(s.planName || "1YEAR").toUpperCase();
        const price = planPrices[plan] || 39999;
        const months = planMonths[plan] || 12;
        mrr += price / months;
      }
    });

    const arr = mrr * 12;
    const renewalRate = 100 - churnRate;

    // Plan-wise distribution
    const planCounts: Record<string, number> = {};
    const planRevenue: Record<string, number> = {};

    stores.forEach((s: any) => {
      const plan = String(s.planName || "1YEAR").toUpperCase();
      planCounts[plan] = (planCounts[plan] || 0) + 1;

      if (s.status === "ACTIVE" || s.status === "TRIAL") {
        const price = planPrices[plan] || 39999;
        planRevenue[plan] = (planRevenue[plan] || 0) + price;
      }
    });

    const planBreakdown = Object.keys(planCounts).map(plan => ({
      plan,
      count: planCounts[plan],
      revenue: planRevenue[plan] || 0
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalSubscribers,
        activeSubs,
        expiredSubs,
        trialAccounts,
        mrr: Math.round(mrr),
        arr: Math.round(arr),
        churnRate: Math.round(churnRate * 100) / 100,
        renewalRate: Math.round(renewalRate * 100) / 100,
        planBreakdown
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/subscription-analytics/plans ─────────────────────────────
export const getSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-plans", "Accessed Plan performance stats");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const stores = await Subscription.find({}).lean();
    const planCounts: Record<string, number> = {};
    const activeCounts: Record<string, number> = {};

    stores.forEach((s: any) => {
      const plan = String(s.planName || "1YEAR").toUpperCase();
      planCounts[plan] = (planCounts[plan] || 0) + 1;
      if (s.status === "ACTIVE") {
        activeCounts[plan] = (activeCounts[plan] || 0) + 1;
      }
    });

    const data = Object.keys(planCounts).map(plan => ({
      plan,
      total: planCounts[plan],
      active: activeCounts[plan] || 0,
      price: planPrices[plan] || 39999
    }));

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/subscription-analytics/revenue ───────────────────────────
export const getSubscriptionRevenue = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-revenue", "Accessed Recurring Revenue monthly trends");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const list = await Subscription.aggregate([
      {
        $project: {
          formattedDate: {
            $dateToString: {
              format: "%Y-%m",
              date: { $dateFromString: { dateString: "$joinDate", onError: new Date() } }
            }
          },
          planName: 1,
          status: 1
        }
      },
      {
        $group: {
          _id: "$formattedDate",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const data = list.map((item: any) => {
      // Estimate MRR curve based on onboarded counts
      const estRevenue = item.count * 39999 / 12; // standard plan MRR projection
      return {
        label: item._id,
        revenue: Math.round(estRevenue),
        count: item.count
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/subscription-analytics/churn ─────────────────────────────
export const getSubscriptionChurn = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-churn", "Accessed Churn trends");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const stores = await Subscription.find({}).lean();
    const active = stores.filter((s: any) => s.status === "ACTIVE").length;
    const inactive = stores.filter((s: any) => s.status === "EXPIRED" || s.status === "SUSPENDED").length;

    const data = [
      { name: "Active", count: active },
      { name: "Churned", count: inactive }
    ];

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/subscription-analytics/summary ───────────────────────────
export const getSubscriptionSummary = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-summary", "Accessed Subscription Analytics summary text");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: "Platform analytics database offline." });
    }

    const total = await Subscription.countDocuments({});
    const active = await Subscription.countDocuments({ status: "ACTIVE" });

    const summaryText = `Subscription Metrics Summary: The platform currently hosts ${total} total subscription tenants, with ${active} ACTIVE store subscriptions driving MRR growth.`;

    return res.status(200).json({ success: true, data: summaryText });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
