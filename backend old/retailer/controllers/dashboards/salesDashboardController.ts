import { Request, Response } from "express";


import { Sale, Order, Customer, DesignMoodboard, DesignApproval } from "../../models/index.js";
import { mockOrders, mockSales } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

const getFallbackSalesPayload = () => ({
  summary: {
    totalSales: mockSales.length,
    todaySales: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    totalOrders: mockOrders.length,
    completedOrders: 0,
    pendingOrders: 0,
    totalCustomers: 0,
    activeOffers: 5,
  },
  recentSales: mockSales,
  topCustomers: [],
  salesTrend: [],
  conversionRate: "0%",
  averageOrderValue: 0,
});

export const getSalesDashboard = async (_req: Request, res: Response) => {
  try {
    const allSales = isDbConnected() ? await Sale.find().lean() : mockSales;
    const allOrders = isDbConnected() ? await Order.find().lean() : mockOrders;
    const allCustomers = isDbConnected() ? await Customer.find().lean() : [];

    // Fetch moodboard dashboard stats
    let moodboardsCount = 0;
    let recentlyUploadedMoodboards: any[] = [];
    let pendingApprovals = 0;
    let approvedDesigns = 0;
    let rejectedDesigns = 0;
    let changesRequestedCount = 0;

    if (isDbConnected()) {
      try {
        moodboardsCount = await DesignMoodboard.countDocuments({ status: "ACTIVE" });
        recentlyUploadedMoodboards = await DesignMoodboard.find({ status: "ACTIVE" })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        
        pendingApprovals = await DesignApproval.countDocuments({ approvalStatus: "PENDING" });
        approvedDesigns = await DesignApproval.countDocuments({ approvalStatus: "APPROVED" });
        rejectedDesigns = await DesignApproval.countDocuments({ approvalStatus: "REJECTED" });
        changesRequestedCount = await DesignApproval.countDocuments({ approvalStatus: "CHANGES_REQUESTED" });
      } catch (err) {
        console.error("[Dashboard] Failed to load moodboard stats", err);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today);
    monthStart.setDate(1);

    // Filter today's sales
    const todaySalesItems = allSales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= today && d < tomorrow;
    });
    const todayRevenue = todaySalesItems.reduce((acc, curr) => acc + (curr.total || 0), 0);

    // Filter month's sales
    const monthSalesItems = allSales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= monthStart;
    });
    const monthlyRevenue = monthSalesItems.reduce((acc, curr) => acc + (curr.total || 0), 0);

    // Calculate average order value
    const totalRevenueSum = allSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const averageOrderValue = allSales.length > 0 ? Math.round(totalRevenueSum / allSales.length) : 0;

    // Recent Sales (latest 10)
    const recentSales = [...allSales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    // Top Customers
    const customerStats: Record<string, { name: string; phone: string; purchaseCount: number; totalSpent: number }> = {};
    allSales.forEach(s => {
      const key = s.customerId || s.customerPhone || s.customerName || "unknown";
      if (!customerStats[key]) {
        customerStats[key] = {
          name: s.customerName,
          phone: s.customerPhone || "N/A",
          purchaseCount: 0,
          totalSpent: 0
        };
      }
      customerStats[key].purchaseCount += 1;
      customerStats[key].totalSpent += (s.total || 0);
    });
    const topCustomers = Object.values(customerStats).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

    // Sales Trend (last 7 days)
    const trendMap: Record<string, { _id: string; sales: number; revenue: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      trendMap[dateStr] = { _id: dateStr, sales: 0, revenue: 0 };
    }

    allSales.forEach(s => {
      const dateStr = new Date(s.createdAt).toISOString().split("T")[0];
      if (trendMap[dateStr]) {
        trendMap[dateStr].sales += 1;
        trendMap[dateStr].revenue += (s.total || 0);
      }
    });
    const salesTrend = Object.values(trendMap);

    // Top Selling Items
    const soldItemCounts: Record<string, { name: string; count: number; totalValue: number }> = {};
    allSales.forEach((sale: any) => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const key = item.name || "Unnamed Item";
          if (!soldItemCounts[key]) {
            soldItemCounts[key] = {
              name: key,
              count: 0,
              totalValue: 0
            };
          }
          soldItemCounts[key].count += 1;
          soldItemCounts[key].totalValue += (item.total || item.price || 0);
        });
      }
    });
    const topSellingItems = Object.values(soldItemCounts).sort((a, b) => b.count - a.count).slice(0, 5);

    res.json({
      success: true,
      data: {
        summary: {
          totalSales: allSales.length,
          todaySales: todaySalesItems.length,
          todayRevenue,
          monthlyRevenue,
          totalOrders: allOrders.length,
          completedOrders: allOrders.filter(o => o.status === "DELIVERED").length,
          pendingOrders: allOrders.filter(o => o.status === "PENDING").length,
          totalCustomers: allCustomers.length || Object.keys(customerStats).length,
          activeOffers: 5,
        },
        recentSales,
        topCustomers,
        salesTrend,
        topSellingItems,
          moodboardsCount,
          recentlyUploadedMoodboards,
          pendingApprovals,
          approvedDesigns,
          rejectedDesigns,
          changesRequestedCount,
        conversionRate: "45.2%",
        averageOrderValue,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching dashboard data",
    });
  }
};

export const getSalesManagement = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: mockSales,
      });
    }

    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: sales,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching sales",
    });
  }
};

export const getOrderManagement = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: mockOrders,
      });
    }

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching orders",
    });
  }
};

export const getOfferManagement = async (_req: Request, res: Response) => {
  try {
    // This would fetch from an Offers collection if it exists
    // For now, returning mock data
    const offers = [
      {
        _id: "1",
        name: "Summer Sale",
        discount: 20,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        _id: "2",
        name: "New Customer Offer",
        discount: 15,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    ];

    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching offers",
    });
  }
};

export const getCustomerManagement = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const customers = await Customer.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const customerCount = customers.length;
    const vipCount = customers.filter((cust: any) => String(cust.customerTier || cust.tags?.[0] || 'REGULAR').toUpperCase() === 'VIP' || (Array.isArray(cust.tags) && cust.tags.map((t: any) => String(t).toUpperCase()).includes('VIP'))).length;
    const blacklistedCount = customers.filter((cust: any) => String(cust.customerTier || cust.tags?.[0] || 'REGULAR').toUpperCase() === 'BLACKLISTED' || (Array.isArray(cust.tags) && cust.tags.map((t: any) => String(t).toUpperCase()).includes('BLACKLISTED'))).length;

    const customersWithHistory = await Promise.all(
      customers.map(async (customer: any) => {
        const purchases = await Sale.countDocuments({ customerId: customer._id });
        return {
          ...customer,
          totalPurchases: purchases,
        };
      })
    );

    res.json({
      success: true,
      data: {
        customerCount,
        vipCount,
        blacklistedCount,
        customers: customersWithHistory,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching customers",
    });
  }
};

export const createSale = async (req: Request, res: Response) => {
  try {
    const saleData = req.body;
    const sale = new Sale(saleData);
    await sale.save();

    res.status(201).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error creating sale",
    });
  }
};


