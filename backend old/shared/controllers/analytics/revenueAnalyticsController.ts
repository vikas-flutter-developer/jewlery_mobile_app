import { Request, Response } from "express";
import mongoose from "mongoose";
import { SuperAdminSubscription as Subscription, SuperAdminSecurityAudit as SecurityAudit } from "../../../superadmin/models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import InvoiceModel from "../../../models/Invoice.js";
import SaleModel from "../../../models/Sale.js";

const getDbReady = () => mongoose.connection.readyState === 1 && isDbConnected();

const logAnalyticsAccess = async (actor: string, action: string, details: string) => {
  try {
    if (getDbReady()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "RevenueAnalytics",
        entityId: "revenue-analytics",
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write revenue analytics audit log:", err);
  }
};

// ─── GET /api/revenue-analytics/dashboard ─────────────────────────────────────
export const getRevenueDashboard = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    await logAnalyticsAccess(actor, "access-dashboard", "Accessed Revenue Analytics Dashboard metrics");

    if (!getDbReady()) {
      return res.status(200).json({
        success: true,
        data: { totalRevenue: 0, netRevenue: 0, averageOrderValue: 0, growthPercent: 0, totalOrders: 0, totalInvoices: 0 }
      });
    }

    const stores = await Subscription.find({}).lean();
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalInvoices = 0;
    let lastPeriodRevenue = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const storeBreakdown: any[] = [];
    const monthlyTrendMap = new Map<string, number>();

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const InvModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");
      const SaleModel = tenantDb.models.Sale || tenantDb.model("Sale", SaleModel.schema, "sales");

      const invoicesCount = await InvModel.countDocuments({ status: "final" });
      const salesCount = await SaleModel.countDocuments({});

      // Sum revenue in current 30 days
      const currentAgg = await InvModel.aggregate([
        { $match: { status: "final", createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]);
      const currentSum = currentAgg[0]?.total || 0;

      // Sum revenue in prior 30 days (for growth %)
      const priorAgg = await InvModel.aggregate([
        { $match: { status: "final", createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]);
      const priorSum = priorAgg[0]?.total || 0;

      // All-time revenue for this store
      const allTimeAgg = await InvModel.aggregate([
        { $match: { status: "final" } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]);
      const storeTotal = allTimeAgg[0]?.total || 0;

      totalRevenue += storeTotal;
      totalInvoices += invoicesCount;
      totalOrders += salesCount;
      lastPeriodRevenue += priorSum;

      storeBreakdown.push({
        storeId: s.id,
        shopName: s.shopName,
        revenue: Math.round(storeTotal * 100) / 100
      });

      // Monthly trend aggregates
      const trend = await InvModel.aggregate([
        { $match: { status: "final" } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            total: { $sum: "$grandTotal" }
          }
        }
      ]);

      trend.forEach((t: any) => {
        const label = `${t._id.year}-${String(t._id.month).padStart(2, "0")}`;
        const curr = monthlyTrendMap.get(label) || 0;
        monthlyTrendMap.set(label, curr + t.total);
      });
    }

    const netRevenue = totalRevenue * 0.95; // net after estimated returns/discounts/exchanges
    const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // Growth calculation
    let growthPercent = 0;
    if (lastPeriodRevenue > 0) {
      growthPercent = ((totalRevenue - lastPeriodRevenue) / lastPeriodRevenue) * 100;
    }

    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .map(([label, revenue]) => ({ label, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        grossRevenue: Math.round(totalRevenue * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        growthPercent: Math.round(growthPercent * 100) / 100,
        totalOrders,
        totalInvoices,
        storeBreakdown,
        monthlyTrend
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/revenue-analytics/sales ─────────────────────────────────────────
export const getRevenueSales = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    await logAnalyticsAccess(actor, "access-sales", "Accessed Revenue Analytics sales breakdowns");

    const { filter = "monthly" } = req.query; // daily, weekly, monthly, yearly

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const stores = await Subscription.find({}).lean();
    const trendMap = new Map<string, number>();

    let format = "%Y-%m";
    if (filter === "daily") format = "%Y-%m-%d";
    else if (filter === "yearly") format = "%Y";
    else if (filter === "weekly") format = "%G-W%V";

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const InvModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");

      const list = await InvModel.aggregate([
        { $match: { status: "final" } },
        {
          $project: {
            formattedDate: { $dateToString: { format, date: "$createdAt" } },
            grandTotal: 1
          }
        },
        { $group: { _id: "$formattedDate", total: { $sum: "$grandTotal" } } }
      ]);

      list.forEach((item: any) => {
        const curr = trendMap.get(item._id) || 0;
        trendMap.set(item._id, curr + item.total);
      });
    }

    const data = Array.from(trendMap.entries())
      .map(([label, revenue]) => ({ label, revenue: Math.round(revenue * 100) / 100 }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/revenue-analytics/customers ─────────────────────────────────────
export const getRevenueCustomers = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    await logAnalyticsAccess(actor, "access-customers", "Accessed Revenue Analytics top customers");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const stores = await Subscription.find({}).lean();
    const customersMap = new Map<string, { name: string; email: string; totalSpent: number; ordersCount: number }>();

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const InvModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");

      const topCusts = await InvModel.aggregate([
        { $match: { status: "final" } },
        {
          $group: {
            _id: "$customerInfo.phone",
            name: { $first: "$customerInfo.name" },
            email: { $first: "$customerInfo.email" },
            totalSpent: { $sum: "$grandTotal" },
            ordersCount: { $sum: 1 }
          }
        }
      ]);

      topCusts.forEach((c: any) => {
        if (!c._id) return;
        const existing = customersMap.get(c._id) || { name: c.name || "Walk-in", email: c.email || "", totalSpent: 0, ordersCount: 0 };
        customersMap.set(c._id, {
          name: c.name || existing.name,
          email: c.email || existing.email,
          totalSpent: existing.totalSpent + c.totalSpent,
          ordersCount: existing.ordersCount + c.ordersCount
        });
      });
    }

    const data = Array.from(customersMap.entries())
      .map(([phone, info]) => ({ phone, ...info }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 15);

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/revenue-analytics/products ──────────────────────────────────────
export const getRevenueProducts = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    await logAnalyticsAccess(actor, "access-products", "Accessed Revenue Analytics top products");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const stores = await Subscription.find({}).lean();
    const productMap = new Map<string, { category: string; metalType: string; totalRevenue: number; qtySold: number }>();

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
        const existing = productMap.get(key) || { category: "Jewellery", metalType: item.metalType || "GOLD", totalRevenue: 0, qtySold: 0 };
        productMap.set(key, {
          category: existing.category,
          metalType: item.metalType || existing.metalType,
          totalRevenue: existing.totalRevenue + item.totalRevenue,
          qtySold: existing.qtySold + item.qtySold
        });
      });
    }

    const data = Array.from(productMap.entries())
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 15);

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/revenue-analytics/summary ───────────────────────────────────────
export const getRevenueSummary = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "user";
    await logAnalyticsAccess(actor, "access-summary", "Accessed Revenue Analytics text summary");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: "Platform analytics database offline." });
    }

    const stores = await Subscription.find({}).lean();
    let totalRevenue = 0;
    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const InvModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");
      const allTime = await InvModel.aggregate([
        { $match: { status: "final" } },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } }
      ]);
      totalRevenue += allTime[0]?.total || 0;
    }

    const summaryText = `Financial Overview: Total platform transactional revenue accumulated is ₹${totalRevenue.toLocaleString()}.`;

    return res.status(200).json({ success: true, data: summaryText });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
