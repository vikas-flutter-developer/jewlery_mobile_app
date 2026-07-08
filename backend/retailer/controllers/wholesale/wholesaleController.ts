import { Request, Response } from "express";
import { mockRates } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { Rate } from "../../models/index.js";

type WholesaleItem = {
  description: string;
  metal: string;
  purity: string;
  weight: number;
  unitRate: number;
  quantity?: number;
};

type WholesaleOrder = {
  id: string;
  invoiceNumber: string;
  customer: string;
  itemDescription: string;
  metal: string;
  purity: string;
  weight: number;
  unitRate: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  deliveryDate: string;
  status: string;
  createdAt: string;
  notes?: string;
  source: "fallback" | "database";
};

type WholesaleChallan = {
  challanId: string;
  invoiceNumber: string;
  customer: string;
  itemDescription: string;
  metal: string;
  purity: string;
  weight: number;
  unitRate: number;
  quantity: number;
  status: string;
  issuedAt: string;
  notes?: string;
  source: "fallback" | "database";
};

const wholesaleOrders: WholesaleOrder[] = [];
const wholesaleChallans: WholesaleChallan[] = [];

const parseNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeMetal = (value: unknown) => {
  const metal = String(value ?? "").trim().toLowerCase();

  if (metal.includes("gold")) {
    return "Gold";
  }

  if (metal.includes("silver")) {
    return "Silver";
  }

  if (metal.includes("platinum")) {
    return "Platinum";
  }

  return value ? String(value) : "Gold";
};

const normalizePurity = (value: unknown) => {
  const purity = String(value ?? "").trim();
  return purity || "24K";
};

const getFallbackRate = (metal: string, purity: string) => {
  const normalizedMetal = normalizeMetal(metal).toLowerCase();

  if (normalizedMetal.includes("gold")) {
    if (purity === "22K") {
      return 5600;
    }

    return 6200;
  }

  if (normalizedMetal.includes("silver")) {
    return 75;
  }

  if (normalizedMetal.includes("platinum")) {
    return 2500;
  }

  return 6200;
};

const resolveRate = async (metal: string, purity: string, unitRate?: number) => {
  if (Number.isFinite(unitRate) && unitRate !== undefined && unitRate !== null && unitRate > 0) {
    return Number(unitRate);
  }

  if (isDbConnected()) {
    try {
      const dbRate = await Rate.findOne({ metal: normalizeMetal(metal) }).lean();
      if (dbRate?.rate) {
        return Number(dbRate.rate);
      }
    } catch (error) {
      // Ignore and fall back to mock rates.
    }
  }

  const matchedRate = mockRates.find((item) => {
    const itemMetal = String(item.metal).toLowerCase();
    return itemMetal.includes(normalizeMetal(metal).toLowerCase());
  });

  if (matchedRate?.rate) {
    return Number(matchedRate.rate);
  }

  return getFallbackRate(metal, purity);
};

const buildWholesaleOrder = async (body: any): Promise<WholesaleOrder> => {
  const customer = String(body?.customer || body?.partyName || "Wholesale Customer").trim() || "Wholesale Customer";
  const invoiceNumber = String(body?.invoiceNumber || body?.invoiceNo || `INV-${Date.now()}`).trim() || `INV-${Date.now()}`;
  const itemDescription = String(body?.itemDescription || body?.description || body?.item || "Custom Wholesale Item").trim() || "Custom Wholesale Item";
  const metal = normalizeMetal(body?.metal);
  const purity = normalizePurity(body?.purity);
  const weight = parseNumber(body?.weight, 0);
  const discount = Math.max(0, parseNumber(body?.discount, 0));
  const unitRate = await resolveRate(metal, purity, parseNumber(body?.unitRate, NaN));
  const subtotal = Math.round(weight * unitRate);
  const tax = Math.round(subtotal * 0.03);
  const total = Math.max(0, Math.round(subtotal - (subtotal * discount / 100) + tax));
  const deliveryDate = String(body?.deliveryDate || new Date().toISOString().slice(0, 10));
  const status = String(body?.status || "CONFIRMED");
  const notes = body?.notes ? String(body.notes) : undefined;

  const order: WholesaleOrder = {
    id: `WO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    invoiceNumber,
    customer,
    itemDescription,
    metal,
    purity,
    weight,
    unitRate,
    discount,
    subtotal,
    tax,
    total,
    deliveryDate,
    status,
    createdAt: new Date().toISOString(),
    notes,
    source: isDbConnected() ? "database" : "fallback",
  };

  wholesaleOrders.unshift(order);
  return order;
};

const buildWholesaleChallan = (body: any, order: WholesaleOrder): WholesaleChallan => {
  const challanId = String(body?.challanId || body?.challanNumber || `CHL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).trim() || `CHL-${Date.now()}`;
  const quantity = Math.max(1, parseNumber(body?.quantity, 1));

  const challan: WholesaleChallan = {
    challanId,
    invoiceNumber: order.invoiceNumber,
    customer: order.customer,
    itemDescription: order.itemDescription,
    metal: order.metal,
    purity: order.purity,
    weight: order.weight,
    unitRate: order.unitRate,
    quantity,
    status: String(body?.status || "PENDING"),
    issuedAt: new Date().toISOString(),
    notes: body?.notes ? String(body.notes) : undefined,
    source: isDbConnected() ? "database" : "fallback",
  };

  wholesaleChallans.unshift(challan);
  return challan;
};

const getOrderPayload = (order: WholesaleOrder) => ({
  id: order.id,
  invoiceNumber: order.invoiceNumber,
  customer: order.customer,
  itemDescription: order.itemDescription,
  metal: order.metal,
  purity: order.purity,
  weight: order.weight,
  unitRate: order.unitRate,
  discount: order.discount,
  subtotal: order.subtotal,
  tax: order.tax,
  total: order.total,
  deliveryDate: order.deliveryDate,
  status: order.status,
  createdAt: order.createdAt,
  notes: order.notes,
});

export const getWholesaleOrders = (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: wholesaleOrders.map(getOrderPayload),
  });
};

export const createWholesaleChallan = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const order = await buildWholesaleOrder(body);
    const challan = buildWholesaleChallan(body, order);

    res.status(201).json({
      success: true,
      data: challan,
      message: "Wholesale challan created",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to create wholesale challan",
    });
  }
};

export const createWholesaleInvoice = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const order = await buildWholesaleOrder(body);

    res.status(201).json({
      success: true,
      data: getOrderPayload(order),
      message: "Wholesale invoice created",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to create wholesale invoice",
    });
  }
};

export const deleteWholesaleOrder = (req: Request, res: Response) => {
  const { id } = req.params;
  const index = wholesaleOrders.findIndex((order) => order.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Wholesale order not found",
    });
  }

  wholesaleOrders.splice(index, 1);
  return res.json({
    success: true,
    message: "Wholesale order deleted",
  });
};


