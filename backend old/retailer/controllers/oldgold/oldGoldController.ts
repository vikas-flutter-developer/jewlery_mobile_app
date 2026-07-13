import { Request, Response } from "express";
import {
  mockOldGoldPurchases,
  mockOldGoldStock,
  mockOldGoldDeductions,
  mockOldGoldIssuances,
  mockOldGoldMeltingLogs,
} from "../../../data/mockData.js";

const genId = (prefix = "OG") => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

export const createOldGoldPurchase = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const supplierName = String(body.supplierName || body.customerName || "Unknown Customer").trim();
    const grossWeight = Number(body.grossWeight || body.weight || 0);
    const netWeight = Number(body.netWeight || grossWeight);
    const purity = String(body.purity || "22K");
    const pricePerGram = Number(body.pricePerGram || body.ratePerGram || 0);
    const total = Number(body.total || body.totalPaid || Math.round(netWeight * pricePerGram));

    if (netWeight <= 0) {
      return res.status(400).json({ success: false, error: "netWeight must be > 0" });
    }

    const purchaseId = genId("OGP");

    const purchaseRecord = {
      purchaseId,
      supplierName,
      customerName: supplierName,
      grossWeight,
      weight: grossWeight,
      netWeight,
      purity,
      pricePerGram,
      ratePerGram: pricePerGram,
      total,
      totalPaid: total,
      notes: String(body.notes || ""),
      createdAt: new Date().toISOString(),
    };

    mockOldGoldPurchases.push(purchaseRecord);

    // create stock entry
    const stockId = genId("OG");
    const stockRecord = {
      stockId,
      purchaseId,
      availableWeight: netWeight,
      purity,
      status: "available",
      createdAt: new Date().toISOString(),
    };

    mockOldGoldStock.push(stockRecord);

    return res.status(201).json({ success: true, data: { purchase: purchaseRecord, stock: stockRecord } });
  } catch (error: any) {
    console.error("OldGold create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create old gold purchase" });
  }
};

export const listOldGoldStock = async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: mockOldGoldStock });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to list old gold stock" });
  }
};

export const createOldGoldDeduction = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const invoiceId = String(body.invoiceId || "").trim();
    const stockId = String(body.stockId || "").trim();
    const weight = Number(body.weight || 0);
    const value = Number(body.value || 0);

    if (!invoiceId || !stockId || weight <= 0) {
      return res.status(400).json({ success: false, error: "invoiceId, stockId and weight are required" });
    }

    const stock = mockOldGoldStock.find(s => s.stockId === stockId);
    if (!stock) return res.status(404).json({ success: false, error: "stock not found" });
    if (stock.availableWeight < weight) return res.status(400).json({ success: false, error: "insufficient old gold weight in stock" });

    stock.availableWeight = Math.max(0, Number(stock.availableWeight) - weight);
    if (stock.availableWeight === 0) stock.status = "consumed";

    const deduction = {
      deductionId: genId("OGD"),
      invoiceId,
      stockId,
      weight,
      value,
      createdAt: new Date().toISOString(),
    };

    mockOldGoldDeductions.push(deduction);

    return res.status(201).json({ success: true, data: deduction });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to create deduction" });
  }
};

export const issueOldGoldToKarikar = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const karikarId = String(body.karikarId || "").trim();
    const stockId = String(body.stockId || "").trim();
    const weight = Number(body.weight || 0);

    if (!karikarId || !stockId || weight <= 0) {
      return res.status(400).json({ success: false, error: "karikarId, stockId and weight are required" });
    }

    const stock = mockOldGoldStock.find(s => s.stockId === stockId);
    if (!stock) return res.status(404).json({ success: false, error: "stock not found" });
    if (stock.availableWeight < weight) return res.status(400).json({ success: false, error: "insufficient weight in stock" });

    stock.availableWeight = Math.max(0, Number(stock.availableWeight) - weight);
    if (stock.availableWeight === 0) stock.status = "issued";

    const issuance = {
      issuanceId: genId("OGI"),
      karikarId,
      stockId,
      weight,
      notes: String(body.notes || ""),
      createdAt: new Date().toISOString(),
    };

    mockOldGoldIssuances.push(issuance);

    return res.status(201).json({ success: true, data: issuance });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to issue to karikar" });
  }
};

export const createMeltingLog = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const stockIds = Array.isArray(body.stockIds) ? body.stockIds : [];
    const totalWeight = Number(body.totalWeight || 0);
    const refinery = String(body.refinery || "").trim();
    const lotNumber = String(body.lotNumber || genId("MELT"));

    if (stockIds.length === 0 || totalWeight <= 0) {
      return res.status(400).json({ success: false, error: "stockIds and totalWeight are required" });
    }

    // mark stocks as sent
    for (const sid of stockIds) {
      const s = mockOldGoldStock.find(x => x.stockId === sid);
      if (s) s.status = "sent_to_refinery";
    }

    const log = {
      meltingId: genId("MELT"),
      lotNumber,
      refinery,
      stockIds,
      totalWeight,
      notes: String(body.notes || ""),
      createdAt: new Date().toISOString(),
    };

    mockOldGoldMeltingLogs.push(log);

    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to create melting log" });
  }
};

export const getOldGoldPurchases = async (_req: Request, res: Response) => {
  try {
    const mapped = mockOldGoldPurchases.map((p: any) => ({
      ...p,
      customerName: p.customerName || p.supplierName || "Unknown Customer",
      weight: p.weight !== undefined ? p.weight : (p.grossWeight || p.netWeight || 0),
      purity: p.purity || "22K",
      ratePerGram: p.ratePerGram !== undefined ? p.ratePerGram : (p.pricePerGram || 0),
      totalPaid: p.totalPaid !== undefined ? p.totalPaid : (p.total || 0),
    }));
    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to fetch purchases" });
  }
};

export const getMeltingLogs = async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: mockOldGoldMeltingLogs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to fetch melting logs" });
  }
};


