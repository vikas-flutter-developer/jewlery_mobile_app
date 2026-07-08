import { Response } from "express";
import mongoose from "mongoose";
import { Sale as DefaultSale, Order as DefaultOrder } from "../../../models/index.js";
import { Sale as RetailerSale, Order as RetailerOrder, DesignMoodboardAuditLog as RetailerMoodboardAuditLog, DesignApprovalAuditLog as RetailerApprovalAuditLog } from "../../../retailer/models/index.js";
import { ManufacturerSale, ManufacturerOrder } from "../../../manufacturer/models/index.js";
import { AuthRequest } from "../../../lib/authUtils.js";
import { isDbConnected } from "../../../lib/serverState.js";


interface AuditLogEntry {
  action: string;
  user: string;
  timestamp: Date | string;
  details: string;
}

const getStoreType = (req: any) => {
  if (req.user?.storeType) return req.user.storeType;
  const role = req.user?.role;
  if (role === "RETAILER") return "RETAILER";
  if (role === "ADMIN") return "MANUFACTURER";
  return "RETAILER"; // fallback
};

const getSaleModel = (req: any) => {
  const storeType = getStoreType(req);
  if (storeType === "RETAILER") return RetailerSale;
  if (storeType === "MANUFACTURER") return ManufacturerSale;
  return DefaultSale;
};

const getOrderModel = (req: any) => {
  const storeType = getStoreType(req);
  if (storeType === "RETAILER") return RetailerOrder;
  if (storeType === "MANUFACTURER") return ManufacturerOrder;
  return DefaultOrder;
};

const createAuditLogs = (sales: any[], orders: any[], moodboardLogs: any[], approvalLogs: any[], trackingLogs: any[] = [], referralLogs: any[] = []): AuditLogEntry[] => {
  const logs = [

    ...sales.map((sale) => {
      const amount = sale.payable ?? sale.total ?? sale.subtotal ?? 0;

      return {
        action: "Sale Created",
        user: "System",
        timestamp: sale.createdAt,
        details: `Sale of amount: ${amount}`,
      };
    }),
    ...orders.map((order) => ({
      action: "Order Created",
      user: "System",
      timestamp: order.createdAt,
      details: `Order #${order._id}`,
    })),
    ...moodboardLogs.map((log) => ({
      action: `Moodboard ${log.action}`,
      user: log.userEmail || log.userId || "Unknown",
      timestamp: log.createdAt,
      details: log.details || `Moodboard ${log.moodboardId} - Order ${log.orderId}`,
    })),
    ...approvalLogs.map((log) => ({
      action: `Design Approval ${log.action}`,
      user: log.userEmail || log.userId || "Unknown",
      timestamp: log.createdAt,
      details: log.details || `Design ${log.designId} - Order ${log.orderId}`,
    })),
    ...trackingLogs.map((log) => ({
      action: log.action || "Tracking Activity",
      user: log.user || "System",
      timestamp: log.timestamp || log.createdAt,
      details: log.details || `Order ${log.orderId}`,
    })),
    ...(referralLogs || []).map((log: any) => ({
      action: log.action || "Referral Event",
      user: log.user || "System",
      timestamp: log.timestamp || log.createdAt,
      details: log.details || `Referral ID ${log.referralId}`,
    }))
  ]

    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 50);

  return logs;
};


export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const SaleModel = getSaleModel(req);
    const OrderModel = getOrderModel(req);
    const TrackingModel = isDbConnected() ? mongoose.connection.useDb(getStoreType(req) === "RETAILER" ? "retailer" : "manufacturer", { useCache: true }).models.OrderTracking : null;
    const ReferralModel = isDbConnected() ? mongoose.connection.useDb(getStoreType(req) === "RETAILER" ? "retailer" : "manufacturer", { useCache: true }).models.CustomerReferral : null;

    const [sales, orders, moodboardLogs, approvalLogs, trackingLogs, referralLogs] = await Promise.all([
      SaleModel.find().sort({ createdAt: -1 }).limit(20).lean(),
      OrderModel.find().sort({ createdAt: -1 }).limit(20).lean(),
      RetailerMoodboardAuditLog.find().sort({ createdAt: -1 }).limit(20).lean().catch(() => []),
      RetailerApprovalAuditLog.find().sort({ createdAt: -1 }).limit(20).lean().catch(() => []),
      TrackingModel ? (TrackingModel as any).find().sort({ updatedAt: -1 }).limit(20).lean().then((list: any[]) => {
        const events: any[] = [];
        list.forEach((trk) => {
          if (trk.statusTimeline && Array.isArray(trk.statusTimeline)) {
            trk.statusTimeline.forEach((t: any) => {
              events.push({
                action: `Tracking ${t.status}`,
                user: t.updatedBy || "System",
                timestamp: t.updatedAt,
                details: `Order #${trk.orderId} - Code ${trk.trackingCode}`
              });
            });
          }
        });
        return events;
      }).catch(() => []) : Promise.resolve([]),
      ReferralModel ? (ReferralModel as any).find().sort({ createdAt: -1 }).limit(20).lean().then((list: any[]) => {
        const events: any[] = [];
        list.forEach((ref) => {
          events.push({
            action: `Referral ${ref.referralStatus}`,
            user: "System",
            timestamp: ref.createdAt,
            details: `Referrer: ${ref.referrerCustomerId} -> Referred: ${ref.referredCustomerId} [Reward status: ${ref.rewardStatus}]`
          });
        });
        return events;
      }).catch(() => []) : Promise.resolve([])
    ]);

    return res.json({
      success: true,
      data: createAuditLogs(sales, orders, moodboardLogs, approvalLogs, trackingLogs, referralLogs),
    });

  } catch (error) {
    console.error("Failed to fetch audit logs", error);
    return res.json({
      success: true,
      data: [],
    });
  }
};



