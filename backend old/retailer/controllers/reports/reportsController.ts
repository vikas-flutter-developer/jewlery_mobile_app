import { Request, Response } from "express";
import { Inventory, Sale } from "../../models/index.js";
;
import { mockInventory, mockSales } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

type AnyRecord = Record<string, any>;

type ProfitLossSummary = {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  salesCount: number;
  itemsSold: number;
  source: "database" | "fallback";
  generatedAt: string;
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed;
};

const getSaleTotal = (sale: AnyRecord) => {
  const candidates = [
    sale?.total,
    sale?.payable,
    sale?.subtotal,
    sale?.grandTotal,
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate, 0);
    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
};

const getItemQuantity = (item: AnyRecord) => {
  const quantity = toNumber(item?.quantity, 1);
  return quantity > 0 ? quantity : 1;
};

const getItemTotal = (item: AnyRecord) => {
  const candidates = [item?.total, item?.lineTotal, item?.amount, item?.price];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate, 0);
    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
};

const getItemKey = (item: AnyRecord) => {
  const keys = [
    item?.itemId,
    item?.id,
    item?._id,
    item?.barcode,
    item?.sku,
    item?.huid,
    item?.tag,
  ];

  for (const key of keys) {
    const normalized = normalizeString(key);
    if (normalized) {
      return normalized;
    }
  }

  return normalizeString(item?.name);
};

const findInventoryCost = (item: AnyRecord, inventoryRecords: AnyRecord[]) => {
  const key = getItemKey(item);
  const quantity = getItemQuantity(item);

  if (!key) {
    return getItemTotal(item) || 0;
  }

  const matchedRecord = inventoryRecords.find((record) => {
    const candidateKeys = [
      record?._id,
      record?.id,
      record?.barcode,
      record?.sku,
      record?.huid,
      record?.tag,
      record?.name,
    ];

    return candidateKeys.some((candidate) => normalizeString(candidate) === key);
  });

  if (matchedRecord) {
    const unitCost = toNumber(matchedRecord?.price, 0);
    return roundToTwo(unitCost * quantity);
  }

  const itemCost = getItemTotal(item);
  if (itemCost > 0) {
    return roundToTwo(itemCost);
  }

  return 0;
};

const getSalesRecords = async () => {
  if (isDbConnected()) {
    return Sale.find({}).lean();
  }

  return mockSales as AnyRecord[];
};

const getInventoryRecords = async () => {
  if (isDbConnected()) {
    return Inventory.find({}).lean();
  }

  return mockInventory as AnyRecord[];
};

const summarizeProfitLoss = async (): Promise<ProfitLossSummary> => {
  const [salesRecords, inventoryRecords] = await Promise.all([
    getSalesRecords(),
    getInventoryRecords(),
  ]);

  let revenue = 0;
  let costOfGoodsSold = 0;
  let itemsSold = 0;

  for (const sale of salesRecords as AnyRecord[]) {
    const saleRevenue = getSaleTotal(sale);
    const items = Array.isArray(sale?.items) ? sale.items : [];

    revenue += saleRevenue > 0 ? saleRevenue : 0;

    if (items.length === 0) {
      continue;
    }

    for (const item of items) {
      itemsSold += 1;
      costOfGoodsSold += findInventoryCost(item, inventoryRecords as AnyRecord[]);
    }
  }

  if (revenue === 0 && Array.isArray(salesRecords)) {
    for (const sale of salesRecords as AnyRecord[]) {
      const items = Array.isArray(sale?.items) ? sale.items : [];
      for (const item of items) {
        revenue += getItemTotal(item);
      }
    }
  }

  const grossProfit = revenue - costOfGoodsSold;

  return {
    revenue: roundToTwo(revenue),
    costOfGoodsSold: roundToTwo(costOfGoodsSold),
    grossProfit: roundToTwo(grossProfit),
    operatingExpenses: 0,
    netProfit: roundToTwo(grossProfit),
    salesCount: Array.isArray(salesRecords) ? salesRecords.length : 0,
    itemsSold,
    source: isDbConnected() ? "database" : "fallback",
    generatedAt: new Date().toISOString(),
  };
};

export const getProfitLoss = async (_req: Request, res: Response) => {
  try {
    const summary = await summarizeProfitLoss();

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Failed to compute profit-loss summary", error);
    return res.status(500).json({
      success: false,
      error: "Failed to compute profit-loss summary",
    });
  }
};


