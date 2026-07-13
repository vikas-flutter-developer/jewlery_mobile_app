import { Request, Response } from "express";
import mongoose from "mongoose";


import { Sale, Inventory, Karikar } from "../../models/index.js";

const getRange = () => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  return { startOfToday, startOfTomorrow };
};

const formatNumber = (value: number) => Number(value.toFixed(2));

export const getAdminDashboard = async (_req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      return res.json({
        success: true,
        data: {
          todaySales: 0,
          activeJobs: 0,
          goldReserveGrams: 0,
          profitMargin: 0,
        },
      });
    }

    const { startOfToday, startOfTomorrow } = getRange();

    const [todaySalesResult, activeJobsResult, inventoryMetrics] = await Promise.all([
      Sale.aggregate([
        { $match: { createdAt: { $gte: startOfToday, $lt: startOfTomorrow } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$total", 0] } } } },
      ]),
      Karikar.countDocuments({ status: "ACTIVE" }),
      Inventory.aggregate([
        { $group: { _id: null, totalGrams: { $sum: { $multiply: ["$weight", "$stock"] } }, totalValue: { $sum: { $multiply: ["$price", "$stock"] } } } },
      ]),
    ]);

    const todaySales = todaySalesResult[0]?.total || 0;
    const activeJobs = activeJobsResult || 0;
    const goldReserveGrams = formatNumber(inventoryMetrics[0]?.totalGrams || 0);
    const inventoryValue = inventoryMetrics[0]?.totalValue || 0;
    const profitMargin = todaySales > 0
      ? formatNumber(Math.max(0, Math.min(100, ((todaySales - inventoryValue) / todaySales) * 100)))
      : 0;

    return res.json({
      success: true,
      data: {
        todaySales: formatNumber(todaySales),
        activeJobs,
        goldReserveGrams,
        profitMargin,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error fetching admin dashboard data",
    });
  }
};


