import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  SuperAdminSubscription as Subscription,
  SuperAdminUser as GlobalUser,
  SuperAdminSecurityAudit as SecurityAudit
} from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import UserModel from "../../../models/User.js";
import CustomerModel from "../../../models/Customer.js";
import InventoryModel from "../../../models/Inventory.js";
import SaleModel from "../../../models/Sale.js";
import InvoiceModel from "../../../models/Invoice.js";

const getDbReady = () => mongoose.connection.readyState === 1 && isDbConnected();

const logAnalyticsAccess = async (actor: string, action: string, details: string) => {
  try {
    if (getDbReady()) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType: "PlatformAnalytics",
        entityId: "platform-analytics",
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Failed to write platform analytics audit log:", err);
  }
};

// ─── GET /api/admin/platform-analytics/dashboard ──────────────────────────────
export const getPlatformDashboard = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-dashboard", "Accessed Platform Analytics Dashboard metrics");

    if (!getDbReady()) {
      return res.status(200).json({
        success: true,
        data: {
          totalStores: 0, activeStores: 0, inactiveStores: 0,
          totalUsers: 0, activeUsers: 0, newUsers: 0,
          totalCustomers: 0, totalProducts: 0, totalOrders: 0, totalInvoices: 0
        }
      });
    }

    const stores = await Subscription.find({}).lean();
    const totalStores = stores.length;
    const activeStores = stores.filter((s: any) => s.status === "ACTIVE").length;
    const inactiveStores = totalStores - activeStores;

    const totalUsers = await GlobalUser.countDocuments({});
    const activeUsers = await GlobalUser.countDocuments({ status: "ACTIVE" });
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await GlobalUser.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    let totalCustomers = 0;
    let totalProducts = 0;
    let totalOrders = 0;
    let totalInvoices = 0;

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const CustModel = tenantDb.models.Customer || tenantDb.model("Customer", CustomerModel.schema, "customers");
      const InvModel = tenantDb.models.Inventory || tenantDb.model("Inventory", InventoryModel.schema, "inventory");
      const SaleModel = tenantDb.models.Sale || tenantDb.model("Sale", SaleModel.schema, "sales");
      const InvBillModel = tenantDb.models.Invoice || tenantDb.model("Invoice", InvoiceModel.schema, "invoices");

      const [c, p, o, i] = await Promise.all([
        CustModel.countDocuments({}),
        InvModel.countDocuments({}),
        SaleModel.countDocuments({}),
        InvBillModel.countDocuments({})
      ]);
      totalCustomers += c;
      totalProducts += p;
      totalOrders += o;
      totalInvoices += i;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalStores,
        activeStores,
        inactiveStores,
        totalUsers,
        activeUsers,
        newUsers,
        totalCustomers,
        totalProducts,
        totalOrders,
        totalInvoices
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/platform-analytics/users ──────────────────────────────────
export const getPlatformUsers = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-users", "Accessed Platform Analytics Users analytics");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: { globalUsers: [], activeList: [] } });
    }

    const globalUsers = await GlobalUser.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const activeList = await GlobalUser.find({ status: "ACTIVE" }).sort({ lastLogin: -1 }).limit(10).lean();

    return res.status(200).json({
      success: true,
      data: {
        globalUsers,
        activeList
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/platform-analytics/stores ─────────────────────────────────
export const getPlatformStores = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-stores", "Accessed Platform Analytics Stores breakdown");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const stores = await Subscription.find({}).lean();
    const result = [];

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const CustModel = tenantDb.models.Customer || tenantDb.model("Customer", CustomerModel.schema, "customers");
      const InvModel = tenantDb.models.Inventory || tenantDb.model("Inventory", InventoryModel.schema, "inventory");
      const SaleModel = tenantDb.models.Sale || tenantDb.model("Sale", SaleModel.schema, "sales");

      const [customers, products, orders] = await Promise.all([
        CustModel.countDocuments({}),
        InvModel.countDocuments({}),
        SaleModel.countDocuments({})
      ]);

      result.push({
        storeId: s.id,
        shopName: s.shopName,
        status: s.status,
        planName: s.planName,
        storeType: s.storeType || "RETAILER",
        customers,
        products,
        orders
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/platform-analytics/activity ───────────────────────────────
export const getPlatformActivity = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-activity", "Accessed Platform Analytics Activity trends");

    const { viewType = "monthly" } = req.query;

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: { growthTrend: [], orderTrend: [] } });
    }

    let groupFormat = "%Y-%m";
    if (viewType === "daily") groupFormat = "%Y-%m-%d";
    else if (viewType === "yearly") groupFormat = "%Y";
    else if (viewType === "weekly") groupFormat = "%G-W%V";

    // Store subscription growth aggregation
    const storeGrowth = await Subscription.aggregate([
      {
        $project: {
          formattedDate: {
            $dateToString: {
              format: groupFormat,
              date: { $dateFromString: { dateString: "$joinDate", onError: new Date() } }
            }
          }
        }
      },
      { $group: { _id: "$formattedDate", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Order volumes growth aggregation (Sum across all tenant databases)
    const stores = await Subscription.find({}).lean();
    const orderTrendMap = new Map<string, number>();

    for (const s of stores) {
      const tenantDb = mongoose.connection.useDb(`retailer_${s.id}`, { useCache: true });
      const SaleModel = tenantDb.models.Sale || tenantDb.model("Sale", SaleModel.schema, "sales");

      const trend = await SaleModel.aggregate([
        {
          $project: {
            formattedDate: {
              $dateToString: {
                format: groupFormat,
                date: "$createdAt"
              }
            }
          }
        },
        { $group: { _id: "$formattedDate", count: { $sum: 1 } } }
      ]);

      trend.forEach((t: any) => {
        const current = orderTrendMap.get(t._id) || 0;
        orderTrendMap.set(t._id, current + t.count);
      });
    }

    const orderTrend = Array.from(orderTrendMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return res.status(200).json({
      success: true,
      data: {
        growthTrend: storeGrowth.map(g => ({ label: g._id, count: g.count })),
        orderTrend
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET /api/admin/platform-analytics/summary ────────────────────────────────
export const getPlatformSummary = async (req: Request, res: Response) => {
  try {
    const actor = (req as any).user?.email || "super-admin";
    await logAnalyticsAccess(actor, "access-summary", "Accessed Platform Analytics text summary");

    if (!getDbReady()) {
      return res.status(200).json({ success: true, data: "Platform database is offline." });
    }

    const storeCount = await Subscription.countDocuments({});
    const activeStoreCount = await Subscription.countDocuments({ status: "ACTIVE" });
    const userCount = await GlobalUser.countDocuments({});

    const summaryText = `Platform Overview: AuraJewel supports ${storeCount} total stores (${activeStoreCount} currently Active) with ${userCount} registered system users platform-wide.`;

    return res.status(200).json({ success: true, data: summaryText });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
