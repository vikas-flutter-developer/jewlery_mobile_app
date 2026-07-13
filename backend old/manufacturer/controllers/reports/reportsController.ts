import { Request, Response } from "express";
import {
  ManufacturerBranch,
  ManufacturerInventory,
  ManufacturerBarcode,
  ManufacturerDesign,
  ManufacturerGemstoneParcel,
  ManufacturerVendor,
  ManufacturerKarikar,
  ManufacturerOrder,
  ManufacturerRetailerOrder,
  ManufacturerSale,
  ManufacturerWholesaleOrder,
  ManufacturerOldGoldExchange,
  ManufacturerSalesReturn,
  ManufacturerOffer,
  ManufacturerUser,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Reports Summary ──────────────────────────────────────────────────────────

export const getManufacturerReportsSummary = async (_req: Request, res: Response) => {
  try {
    const [
      branches,
      inventory,
      barcodes,
      designs,
      gemstones,
      vendors,
      karikars,
      orders,
      retailerOrders,
      sales,
      wholesale,
      exchanges,
      returnsData,
      offers,
      users,
    ] = await Promise.all([
      ManufacturerBranch.countDocuments(),
      ManufacturerInventory.countDocuments(),
      ManufacturerBarcode.countDocuments(),
      ManufacturerDesign.countDocuments(),
      ManufacturerGemstoneParcel.countDocuments(),
      ManufacturerVendor.countDocuments(),
      ManufacturerKarikar.countDocuments(),
      ManufacturerOrder.countDocuments(),
      ManufacturerRetailerOrder.countDocuments(),
      ManufacturerSale.countDocuments(),
      ManufacturerWholesaleOrder.countDocuments(),
      ManufacturerOldGoldExchange.countDocuments(),
      ManufacturerSalesReturn.countDocuments(),
      ManufacturerOffer.countDocuments(),
      ManufacturerUser.countDocuments(),
    ]);

    return res.json({
      success: true,
      data: {
        branches,
        inventory,
        barcodes,
        designs,
        gemstones,
        vendors,
        karikars,
        orders,
        retailerOrders,
        sales,
        wholesale,
        exchanges,
        returns: returnsData,
        offers,
        users,
      },
    });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer summary report");
  }
};

// ─── Dashboard Metrics ─────────────────────────────────────────────────────────

export const getManufacturerDashboard = async (_req: Request, res: Response) => {
  try {
    // 1. Open orders count
    const openOrdersCount = await ManufacturerOrder.countDocuments({ status: "pending" });

    // 2. Stock weight
    const inventoryItems = await ManufacturerInventory.find({ status: "In Stock" }).lean();
    let totalStockWeight = 0;
    inventoryItems.forEach(item => {
      totalStockWeight += Number(item.netWeight || item.weight || 0);
    });

    // 3. Workshop output & efficiency (mock or aggregate index)
    const activeKarikars = await ManufacturerKarikar.countDocuments({ status: "ACTIVE" });
    const workshopOutputRate = activeKarikars > 0 ? 88 : 0; // standard indicator

    // 4. Daily revenue (sales total for today)
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todaySales = await ManufacturerSale.find({
      createdAt: { $gte: todayStart }
    }).lean();
    const dailyRevenue = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);

    // 5. Active jobs
    const activeJobs = await ManufacturerKarikar.find({ status: "ACTIVE" }).limit(5).lean();

    // 6. Vault statistics (grouped by type)
    const vaultStats: Record<string, number> = { GOLD: 0, DIAMOND: 0, SILVER: 0 };
    inventoryItems.forEach(item => {
      const type = normalizeString(item.type, "GOLD").toUpperCase();
      const wt = Number(item.netWeight || item.weight || 0);
      if (type.includes("GOLD")) {
        vaultStats.GOLD += wt;
      } else if (type.includes("DIAMOND")) {
        vaultStats.DIAMOND += Number(item.diamondWeight || item.weight || 0);
      } else if (type.includes("SILVER")) {
        vaultStats.SILVER += wt;
      }
    });

    return res.json({
      success: true,
      data: {
        metrics: {
          openOrders: openOrdersCount,
          stockWeight: Math.round(totalStockWeight * 100) / 100,
          workshopOutput: workshopOutputRate,
          dailyRevenue: dailyRevenue
        },
        activeJobs: activeJobs.map(k => ({
          id: k._id,
          name: k.name,
          skilled: k.skilled || "Goldsmith",
          status: k.status
        })),
        vault: {
          gold: `${Math.round(vaultStats.GOLD * 100) / 100}g`,
          diamond: `${Math.round(vaultStats.DIAMOND * 100) / 100} cts`,
          silver: `${Math.round(vaultStats.SILVER * 100) / 100}g`
        }
      }
    });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer dashboard metrics");
  }
};
