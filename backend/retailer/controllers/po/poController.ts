import { Request, Response } from "express";

type PurchaseOrderItem = {
  sku?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

type PurchaseOrderRecord = {
  id: string;
  vendor: string;
  branchId: string;
  status: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const purchaseOrders: PurchaseOrderRecord[] = [];

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeItems = (items: unknown): PurchaseOrderItem[] => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }

  return items.map((item: any, index: number) => {
    if (!item || typeof item !== "object") {
      throw new Error(`items[${index}] must be an object`);
    }

    const description = String(item.description || item.name || "").trim();
    const quantity = toNumber(item.quantity, NaN);
    const rate = toNumber(item.rate, NaN);

    if (!description) {
      throw new Error(`items[${index}].description is required`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`items[${index}].quantity must be a positive number`);
    }

    if (!Number.isFinite(rate) || rate < 0) {
      throw new Error(`items[${index}].rate must be a non-negative number`);
    }

    const amount = roundToTwo(toNumber(item.amount, quantity * rate));

    return {
      sku: item.sku ? String(item.sku) : undefined,
      description,
      quantity,
      rate,
      amount,
    };
  });
};

const parseCreatePayload = (req: Request) => {
  const { vendor, branchId, status = "DRAFT", items, notes } = req.body ?? {};

  if (!vendor) {
    throw new Error("vendor is required");
  }

  if (!branchId) {
    throw new Error("branchId is required");
  }

  const normalizedItems = normalizeItems(items);
  const totalAmount = roundToTwo(normalizedItems.reduce((sum, item) => sum + item.amount, 0));

  return {
    vendor: String(vendor),
    branchId: String(branchId),
    status: String(status || "DRAFT"),
    items: normalizedItems,
    totalAmount,
    notes: notes ? String(notes) : undefined,
  };
};

const buildRecord = (payload: ReturnType<typeof parseCreatePayload>): PurchaseOrderRecord => {
  const now = new Date().toISOString();

  return {
    id: `PO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    vendor: payload.vendor,
    branchId: payload.branchId,
    status: payload.status,
    items: payload.items,
    totalAmount: payload.totalAmount,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now,
  };
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const payload = parseCreatePayload(req);
    const record = buildRecord(payload);
    purchaseOrders.push(record);

    return res.status(201).json({
      success: true,
      message: "Purchase order created",
      data: record,
    });
  } catch (error: any) {
    const statusCode = error?.message?.includes("required") || error?.message?.includes("must") ? 400 : 500;
    return res.status(statusCode).json({ error: error.message || "Failed to create purchase order" });
  }
};

export const updatePurchaseOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const record = purchaseOrders.find((entry) => entry.id === id);
    if (!record) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    record.status = String(status);
    record.updatedAt = new Date().toISOString();

    return res.json({
      success: true,
      message: "Purchase order status updated",
      data: record,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update purchase order status" });
  }
};


