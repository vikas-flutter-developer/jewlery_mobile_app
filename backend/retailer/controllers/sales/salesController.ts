import { Request, Response } from "express";
import { Sale } from "../../models/index.js";
import { mockSales } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

export const getSales = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) return res.json(mockSales);
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    console.error("Fetch sales error:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
};

export const createSale = async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      const newSale = { ...req.body, _id: `mock_sale_${Date.now()}`, createdAt: new Date() };
      mockSales.push(newSale);
      return res.status(201).json(newSale);
    }
    const newSale = new Sale(req.body);
    await newSale.save();
    res.status(201).json(newSale);
  } catch (error) {
    console.error("Save sale error:", error);
    res.status(500).json({ error: "Failed to save sale" });
  }
};


