import { Request, Response } from "express";
import {
  ManufacturerSalesReturn,
  ManufacturerSale,
  ManufacturerInventory,
  ManufacturerOldGoldExchange,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Sales Returns ────────────────────────────────────────────────────────────

export const getManufacturerReturns = async (_req: Request, res: Response) => {
  try {
    const returnsData = await ManufacturerSalesReturn.find({ returnId: { $regex: /^RET/ } }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: returnsData });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer return records");
  }
};

export const createManufacturerReturn = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const orderId = normalizeString(body.orderId);

    const sale = await ManufacturerSale.findOne({ orderId });
    const returnAmount = sale?.total || sale?.subtotal || 0;

    const salesReturn = new ManufacturerSalesReturn({
      returnId: generateId("RET"),
      orderId,
      customerName: normalizeString(body.customerName),
      customerPhone: normalizeString(body.customerPhone || body.customerContact),
      items: (body.items || []).map((item: any) => ({
        itemId: item.itemId,
        quantity: item.quantity || 1,
        reason: item.reason || body.reason,
        total: item.total || 0,
      })),
      status: "PENDING",
      refundStatus: "PENDING",
      returnAmount,
      notes: normalizeString(body.notes || body.reason),
      createdAt: new Date(),
    });

    await salesReturn.save();

    // Restock items in manufacturer inventory
    if (sale && sale.items) {
      for (const saleItem of sale.items) {
        const matchingItem = await ManufacturerInventory.findOne({
          $or: [{ name: saleItem.name }, { sku: saleItem.sku }],
        });
        if (matchingItem) {
          matchingItem.stock = (matchingItem.stock || 0) + 1;
          await matchingItem.save();
        }
      }
    }

    return res.status(201).json({ success: true, data: salesReturn, message: "Manufacturer return saved" });
  } catch (error) {
    return respondError(res, error, "Failed to save manufacturer return");
  }
};

export const updateManufacturerReturnRefund = async (req: Request, res: Response) => {
  try {
    const { returnId } = req.params;
    const { refundStatus } = req.body;
    const updated = await ManufacturerSalesReturn.findOneAndUpdate({ returnId }, { refundStatus }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Return record not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return respondError(res, error, "Failed to update refund status");
  }
};

// ─── Exchanges ────────────────────────────────────────────────────────────────

export const createManufacturerExchange = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const invoiceId = normalizeString(body.invoiceId);
    const returnItemNames = Array.isArray(body.returnItemNames) ? body.returnItemNames : [];
    const newItemIds = Array.isArray(body.newItemIds) ? body.newItemIds : [];
    const reason = normalizeString(body.reason);
    const notes = normalizeString(body.notes);

    const sale = await ManufacturerSale.findOne({ orderId: invoiceId });
    if (!sale) {
      return res.status(404).json({ success: false, error: "Original sale invoice not found" });
    }

    if (sale.items) {
      const itemsToReturn = sale.items.filter((item: any) => returnItemNames.includes(item.name));
      for (const item of itemsToReturn) {
        const invItem = await ManufacturerInventory.findOne({ name: item.name });
        if (invItem) {
          invItem.stock = (invItem.stock || 0) + 1;
          await invItem.save();
        }
      }
    }

    let newValueSum = 0;
    for (const id of newItemIds) {
      const invItem = await ManufacturerInventory.findById(id);
      if (invItem) {
        invItem.stock = Math.max(0, (invItem.stock || 0) - 1);
        await invItem.save();
        newValueSum += invItem.price || 0;
      }
    }

    const exchange = new ManufacturerSalesReturn({
      returnId: generateId("EXC"),
      orderId: invoiceId,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: returnItemNames.map((name: string) => ({ itemId: name, quantity: 1, reason, total: 0 })),
      status: "COMPLETED",
      refundStatus: "COMPLETED",
      returnAmount: newValueSum,
      notes: notes || reason,
      createdAt: new Date(),
    });

    await exchange.save();
    return res.status(201).json({ success: true, data: exchange, message: "Manufacturer exchange saved successfully" });
  } catch (error) {
    return respondError(res, error, "Failed to save manufacturer exchange");
  }
};

export const getManufacturerExchanges = async (_req: Request, res: Response) => {
  try {
    const exchangesData = await ManufacturerSalesReturn.find({ returnId: { $regex: /^EXC/ } }).sort({ createdAt: -1 }).lean();
    const mappedExchanges = exchangesData.map((exc: any) => ({
      exchangeId: exc.returnId,
      invoiceId: exc.orderId,
      customerName: exc.customerName,
      customerPhone: exc.customerPhone,
      itemsReturned: exc.items || [],
      itemsProvided: [],
      returnValue: exc.returnAmount || 0,
      newValue: exc.returnAmount || 0,
      priceDifference: 0,
      reason: exc.notes || "Exchange",
      amountToPay: 0,
      amountToRefund: 0,
      paymentMethod: "CASH",
      exchangeStatus: exc.status || "COMPLETED",
      createdAt: exc.createdAt,
    }));
    return res.json({ success: true, data: mappedExchanges });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer exchange records");
  }
};

export const getManufacturerReturnReasonsReport = async (_req: Request, res: Response) => {
  try {
    const returnsData = await ManufacturerSalesReturn.find({ returnId: { $regex: /^RET/ } }).lean();
    const reasonCounts: Record<string, number> = {};
    returnsData.forEach((ret: any) => {
      const reason = ret.items?.[0]?.reason || ret.notes || "Not specified";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    const report = Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
      percentage: returnsData.length > 0 ? ((count / returnsData.length) * 100).toFixed(2) : "0.00",
    }));
    return res.json({
      success: true,
      data: {
        total: returnsData.length,
        byReason: report,
        refundStatus: {
          pending: returnsData.filter((r: any) => r.refundStatus === "PENDING").length,
          completed: returnsData.filter((r: any) => r.refundStatus === "COMPLETED").length,
        },
      },
    });
  } catch (error) {
    return respondError(res, error, "Failed to generate returns report");
  }
};

export const getManufacturerAvailableInvoices = async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sales = await ManufacturerSale.find({ createdAt: { $gte: thirtyDaysAgo } }).lean();
    const availableInvoices = sales.map((sale: any) => ({
      invoiceId: sale.orderId || sale._id?.toString(),
      customerName: sale.customerName,
      customerPhone: sale.customerPhone || sale.customerEmail,
      total: sale.total || sale.subtotal || 0,
      date: sale.createdAt,
      items: sale.items || [],
    }));
    return res.json({ success: true, data: availableInvoices });
  } catch (error) {
    return respondError(res, error, "Failed to load available invoices for returns");
  }
};

// ─── Old Gold ─────────────────────────────────────────────────────────────────

export const getManufacturerOldGoldExchanges = async (_req: Request, res: Response) => {
  try {
    const exchanges = await ManufacturerOldGoldExchange.find().lean();
    return res.json({ success: true, data: exchanges });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer old gold exchanges");
  }
};

export const createManufacturerOldGoldExchange = async (req: Request, res: Response) => {
  try {
    const exchange = new ManufacturerOldGoldExchange({
      exchangeId: normalizeString(req.body.exchangeId) || generateId("EXC"),
      customerName: normalizeString(req.body.customerName),
      customerEmail: normalizeString(req.body.customerEmail),
      customerPhone: normalizeString(req.body.customerPhone),
      exchangeDate: req.body.exchangeDate ? new Date(req.body.exchangeDate) : new Date(),
      oldGoldSubmitted: req.body.oldGoldSubmitted || {},
      evaluatedValue: Number(req.body.evaluatedValue) || 0,
      newGoldPurchased: req.body.newGoldPurchased || {},
      amountPaid: Number(req.body.amountPaid) || 0,
      paymentMethod: normalizeString(req.body.paymentMethod),
      status: normalizeString(req.body.status, "completed"),
    });
    await exchange.save();
    return res.status(201).json({ success: true, data: exchange, message: "Manufacturer old gold exchange saved" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer old gold exchange");
  }
};
