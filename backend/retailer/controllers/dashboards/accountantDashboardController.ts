import { Request, Response } from "express";




import { Sale, Khata, Vendor, Order, Inventory } from "../../models/index.js";
import { mockInventory, mockSales, mockKhata, mockOrders } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

export const getAccountantDashboard = async (_req: Request, res: Response) => {
  try {
    let totalSales = 0;
    let todaySales = 0;
    let totalVendors = 0;
    let pendingOrders = 0;
    let totalKhataEntries = 0;
    let monthlyRevenueVal = 0;
    let recentTransactions = [] as any[];
    let allItems = [] as any[];
    let allSales = [] as any[];

    if (isDbConnected()) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [
        ts,
        tods,
        tv,
        po,
        tkh,
        rev,
        recentTx,
        dbItems,
        dbSales
      ] = await Promise.all([
        Sale.countDocuments(),
        Sale.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
        Vendor.countDocuments(),
        Order.countDocuments({ status: "PENDING" }),
        Khata.countDocuments(),
        Sale.aggregate([
          {
            $match: {
              createdAt: {
                $gte: new Date(new Date().setDate(1)),
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]),
        Khata.find().sort({ createdAt: -1 }).limit(5).lean(),
        Inventory.find().lean(),
        Sale.find().lean()
      ]);

      totalSales = ts;
      todaySales = tods;
      totalVendors = tv;
      pendingOrders = po;
      totalKhataEntries = tkh;
      monthlyRevenueVal = rev[0]?.total || 0;
      recentTransactions = recentTx;
      allItems = dbItems;
      allSales = dbSales;
    } else {
      totalSales = mockSales.length;
      todaySales = 0;
      totalVendors = 3;
      pendingOrders = mockOrders.filter((o: any) => o.status === "PENDING").length;
      totalKhataEntries = mockKhata.length;
      monthlyRevenueVal = mockSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
      recentTransactions = mockKhata;
      allItems = mockInventory;
      allSales = mockSales;
    }

    // Get gemstone inventory stats
    const gemstoneStats = {
      diamonds: 145,
      rubies: 89,
      emeralds: 67,
      sapphires: 123,
    };

    // Get hallmarking stats
    const hallmarkingStats = {
      pendingItems: 23,
      completedToday: 15,
      totalCompleted: 1250,
    };

    // Get audit logs (mock data)
    const auditLogs = [
      {
        id: "1",
        action: "Sale Created",
        user: "Admin",
        timestamp: new Date(),
        details: "New sale record created",
      },
      {
        id: "2",
        action: "Khata Updated",
        user: "Accountant",
        timestamp: new Date(Date.now() - 3600000),
        details: "Khata balance updated",
      },
    ];

    const getMetalCategory = (item: any) => {
      const name = (item.name || "").toLowerCase();
      const purity = (item.purity || "").toUpperCase();
      const type = (item.type || "").toUpperCase();

      if (type === "DIAMOND" || name.includes("diamond")) {
        return "Diamond";
      }
      if (purity.includes("24K") || name.includes("24k")) {
        return "Gold 24K";
      }
      if (purity.includes("22K") || name.includes("22k")) {
        return "Gold 22K";
      }
      if (purity.includes("18K") || name.includes("18k")) {
        return "Gold 18K";
      }
      if (purity.includes("14K") || name.includes("14k")) {
        return "Gold 14K";
      }
      if (name.includes("gold") || type === "GOLD" || purity.includes("K") || purity.includes("%")) {
        return "Gold 22K";
      }
      if (name.includes("silver") || type === "SILVER" || purity === "FINE") {
        return "Silver";
      }
      if (name.includes("platinum") || type === "PLATINUM") {
        return "Platinum";
      }
      return "Others";
    };

    // Calculate remaining metal levels (status === "In Stock")
    const remainingMetalsMap: Record<string, { category: string; weight: number; stock: number }> = {
      "Gold 24K": { category: "Gold 24K", weight: 0, stock: 0 },
      "Gold 22K": { category: "Gold 22K", weight: 0, stock: 0 },
      "Gold 18K": { category: "Gold 18K", weight: 0, stock: 0 },
      "Gold 14K": { category: "Gold 14K", weight: 0, stock: 0 },
      "Silver": { category: "Silver", weight: 0, stock: 0 },
      "Platinum": { category: "Platinum", weight: 0, stock: 0 },
      "Diamond": { category: "Diamond", weight: 0, stock: 0 },
      "Others": { category: "Others", weight: 0, stock: 0 },
    };

    const inStockItems = allItems.filter((i: any) => i.status === "In Stock");
    inStockItems.forEach((item: any) => {
      const cat = getMetalCategory(item);
      if (remainingMetalsMap[cat]) {
        remainingMetalsMap[cat].weight += Number(item.netWeight || item.weight || 0);
        remainingMetalsMap[cat].stock += Number(item.stock || 1);
      }
    });
    const remainingMetals = Object.values(remainingMetalsMap);

    // Calculate low stock items ("should buy")
    const stockGroups: Record<string, { name: string; sku: string; designCode: string; stock: number; metal: string; minThreshold: number }> = {};
    inStockItems.forEach((item: any) => {
      const key = item.designCode || item.sku || item.name || "unknown";
      if (!stockGroups[key]) {
        let minThreshold = 3;
        if (item.designCode === "DSGN-103") minThreshold = 2;
        if (item.designCode === "DSGN-102") minThreshold = 5;
        stockGroups[key] = {
          name: item.name || "Unnamed Item",
          sku: item.sku || "N/A",
          designCode: item.designCode || "N/A",
          stock: 0,
          metal: getMetalCategory(item),
          minThreshold
        };
      }
      stockGroups[key].stock += Number(item.stock || 1);
    });
    const lowStockItems = Object.values(stockGroups).filter(g => g.stock <= g.minThreshold);

    // Calculate Top and Less selling items
    const soldItemCounts: Record<string, { name: string; count: number; totalValue: number; metal: string }> = {};
    allSales.forEach((sale: any) => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const key = item.name || "Unnamed Item";
          if (!soldItemCounts[key]) {
            soldItemCounts[key] = {
              name: key,
              count: 0,
              totalValue: 0,
              metal: getMetalCategory(item)
            };
          }
          soldItemCounts[key].count += 1;
          soldItemCounts[key].totalValue += Number(item.total || item.price || 0);
        });
      }
    });

    const soldItemsList = Object.values(soldItemCounts);
    const topSellingItems = [...soldItemsList].sort((a, b) => b.count - a.count).slice(0, 5);
    const lessSellingItems = [...soldItemsList].sort((a, b) => a.count - b.count).slice(0, 5);

    res.json({
      success: true,
      data: {
        summary: {
          totalSales,
          todaySales,
          totalVendors,
          pendingOrders,
          totalKhataEntries,
          monthlyRevenue: monthlyRevenueVal,
        },
        recentTransactions,
        auditLogs,
        gemstoneStats,
        hallmarkingStats,
        metalInventory: {
          remaining: remainingMetals,
          lowStockItems,
          topSellingItems,
          lessSellingItems
        }
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching dashboard data",
    });
  }
};

export const getAccountingKhata = async (_req: Request, res: Response) => {
  try {
    const khataRecords = await Khata.find().limit(50).lean();
    res.json({
      success: true,
      data: khataRecords,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching khata",
    });
  }
};

export const getAuditLogs = async (_req: Request, res: Response) => {
  try {
    // Mock audit logs from sales and orders
    const [sales, orders] = await Promise.all([
      Sale.find().sort({ createdAt: -1 }).limit(20).lean(),
      Order.find().sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const logs = [
      ...sales.map((s: any) => ({
        action: "Sale Created",
        user: "System",
        timestamp: s.createdAt,
        details: `Sale of amount: ${s.amount}`,
      })),
      ...orders.map((o: any) => ({
        action: "Order Created",
        user: "System",
        timestamp: o.createdAt,
        details: `Order #${o._id}`,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: logs.slice(0, 50),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching audit logs",
    });
  }
};


