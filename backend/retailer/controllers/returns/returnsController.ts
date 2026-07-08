import { Request, Response } from "express";
import { mockOrders, mockSales, mockInventory } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { Sale } from "../../models/index.js";
import {
  processSalesReturnFinancial,
  getSalesReturnsFromDb,
} from "../../services/financial/salesReturnFinancialService.js";
import { FinancialValidationError } from "../../services/financial/financialEngineService.js";
import { buildAuditContextFromRequest } from "../finance/financeAuditController.js";
import { AuthRequest } from "../../../lib/authUtils.js";

interface SalesReturnItem {
  orderId?: string;
  itemId?: string;
  quantity?: number;
  reason?: string;
}

interface SalesReturnRequest {
  orderId?: string;
  customerId?: string;
  customerName?: string;
  customerContact?: string;
  reason?: string;
  items?: SalesReturnItem[];
  notes?: string;
  refundMethod?: string;
  returnType?: "FULL" | "PARTIAL";
  returnAmount?: number;
}

interface StoredSalesReturn {
  returnId: string;
  orderId: string;
  customerName: string;
  customerContact: string;
  status: string;
  reason: string;
  items: SalesReturnItem[];
  notes?: string;
  refundStatus: string;
  returnAmount: number;
  createdAt: string;
}

interface StoredExchange {
  exchangeId: string;
  invoiceId: string;
  customerName: string;
  customerPhone?: string;
  itemsReturned: any[];
  itemsProvided: any[];
  returnValue: number;
  newValue: number;
  priceDifference: number;
  reason: string;
  amountToPay: number;
  amountToRefund: number;
  paymentMethod: string;
  exchangeStatus: string;
  createdAt: string;
}

const salesReturns: StoredSalesReturn[] = [];
const exchanges: StoredExchange[] = [];

const normalizeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return fallback;
};

const normalizeItems = (items: unknown, orderId: string): SalesReturnItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const normalizedItem = item as SalesReturnItem;
      return {
        orderId,
        itemId: normalizeString(normalizedItem.itemId),
        quantity: typeof normalizedItem.quantity === "number" && normalizedItem.quantity > 0 ? normalizedItem.quantity : 1,
        reason: normalizeString(normalizedItem.reason, "Damaged"),
      };
    })
    .filter(Boolean) as SalesReturnItem[];
};

const generateReturnId = () => `RET-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const generateExchangeId = () => `EXC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const validateOrderExists = (orderId: string) => {
  const matchingSale = mockSales.find((entry: any) => entry.orderId === orderId || entry._id === orderId);
  return Boolean(matchingSale);
};

// Feature 92: Sales Return Flow (select invoice → restock)
export const createSalesReturn = async (req: AuthRequest, res: Response) => {
  try {
    const body = (req.body ?? {}) as SalesReturnRequest;
    const orderId = normalizeString(body.orderId);
    const customerName = normalizeString(body.customerName);
    const customerContact = normalizeString(body.customerContact);
    const reason = normalizeString(body.reason, "Customer return");

    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required" });
    }

    const items = normalizeItems(body.items, orderId);

    if (!customerName) {
      return res.status(400).json({ success: false, error: "customerName is required" });
    }

    if (!customerContact) {
      return res.status(400).json({ success: false, error: "customerContact is required" });
    }

    if (!items.length) {
      return res.status(400).json({ success: false, error: "items are required" });
    }

    if (isDbConnected()) {
      const sale = await Sale.findOne({ orderId }).lean();
      if (!sale) {
        return res.status(404).json({ success: false, error: "Order not found for sales return" });
      }

      const result = await processSalesReturnFinancial({
        orderId,
        customerId: String(sale.customerId || body.customerId || customerContact),
        customerName,
        customerPhone: customerContact,
        items: items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          reason: item.reason,
        })),
        returnType: body.returnType === "PARTIAL" ? "PARTIAL" : "FULL",
        returnAmount: body.returnAmount != null ? Number(body.returnAmount) : undefined,
        refundMethod: body.refundMethod,
        refundReason: reason,
        notes: normalizeString(body.notes) || undefined,
        auditContext: buildAuditContextFromRequest(req),
      });

      return res.status(201).json({
        success: true,
        message: "Sales return processed with financial integration",
        data: result,
      });
    }

    if (!validateOrderExists(orderId)) {
      return res.status(404).json({ success: false, error: "Order not found for sales return" });
    }

    // Get original sale to calculate return amount
    const originalSale = mockSales.find((s: any) => s.orderId === orderId);
    const returnAmount = originalSale?.total || 0;

    const salesReturn: StoredSalesReturn = {
      returnId: generateReturnId(),
      orderId,
      customerName,
      customerContact,
      status: "PENDING",
      reason,
      items,
      notes: normalizeString(body.notes) || undefined,
      refundStatus: "PENDING",
      returnAmount,
      createdAt: new Date().toISOString(),
    };

    salesReturns.push(salesReturn);

    // Feature 95: Restock items to inventory
    if (originalSale && originalSale.items) {
      originalSale.items.forEach((saleItem: any) => {
        const inventoryItem = mockInventory.find(
          (inv: any) => inv.name === saleItem.name || inv._id === saleItem.itemId
        );
        if (inventoryItem) {
          inventoryItem.stock = (inventoryItem.stock || 0) + 1;
          if (inventoryItem.stock > 0) {
            inventoryItem.status = "In Stock";
          }
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: "Sales return processed",
      data: salesReturn,
    });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Failed to create sales return", error);
    return res.status(500).json({ success: false, error: "Failed to process sales return" });
  }
};

// Feature 93 & 94: Exchange Flow with Return Reason Tracking
export const createExchange = async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const invoiceId = normalizeString(body.invoiceId);
    const returnItemNames = Array.isArray(body.returnItemNames) ? body.returnItemNames : [];
    const newItemIds = Array.isArray(body.newItemIds) ? body.newItemIds : [];
    const reason = normalizeString(body.reason, "Not specified");
    const notes = normalizeString(body.notes, "");
    const paymentMethod = normalizeString(body.paymentMethod, "CASH");

    if (!invoiceId) {
      return res.status(400).json({ success: false, error: "invoiceId is required" });
    }

    const originalSale = mockSales.find((s: any) => s.orderId === invoiceId);
    if (!originalSale) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    // Get items being returned
    const itemsReturned = originalSale.items.filter((item: any) =>
      returnItemNames.includes(item.name)
    );

    if (itemsReturned.length === 0) {
      return res.status(400).json({ success: false, error: "No matching items to return" });
    }

    const returnValue = itemsReturned.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

    // Get new items from inventory
    const itemsProvided = newItemIds
      .map((id: string) => mockInventory.find((inv: any) => inv._id === id))
      .filter(Boolean) as any[];

    if (itemsProvided.length === 0) {
      return res.status(400).json({ success: false, error: "No valid new items selected" });
    }

    const newValue = itemsProvided.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
    const priceDifference = newValue - returnValue;

    const exchangeRecord: StoredExchange = {
      exchangeId: generateExchangeId(),
      invoiceId,
      customerName: originalSale.customerName,
      customerPhone: originalSale.customerPhone,
      itemsReturned,
      itemsProvided,
      returnValue,
      newValue,
      priceDifference,
      reason,
      amountToPay: Math.max(0, priceDifference),
      amountToRefund: Math.max(0, -priceDifference),
      paymentMethod,
      exchangeStatus: "COMPLETED",
      createdAt: new Date().toISOString(),
    };

    exchanges.push(exchangeRecord);

    // Feature 95: Update inventory - restock returned items
    itemsReturned.forEach((item: any) => {
      const inventoryItem = mockInventory.find(
        (inv: any) => inv.name === item.name || inv._id === item.itemId
      );
      if (inventoryItem) {
        inventoryItem.stock = (inventoryItem.stock || 0) + 1;
        if (inventoryItem.stock > 0) {
          inventoryItem.status = "In Stock";
        }
      }
    });

    // Feature 95: Update inventory - destock new items
    itemsProvided.forEach((item: any) => {
      item.stock = (item.stock || 0) - 1;
      if (item.stock <= 0) {
        item.status = "Out of Stock";
      }
    });

    return res.status(201).json({
      success: true,
      message: "Exchange processed successfully",
      data: exchangeRecord,
    });
  } catch (error) {
    console.error("Exchange create error:", error);
    return res.status(500).json({ success: false, error: "Failed to process exchange" });
  }
};

// Get sales returns
export const getSalesReturns = async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      const data = await getSalesReturnsFromDb();
      return res.json({ success: true, data });
    }
    return res.json({ success: true, data: salesReturns });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to fetch returns" });
  }
};

// Get exchanges
export const getExchanges = async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: exchanges });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to fetch exchanges" });
  }
};

// Get available invoices for return/exchange (within 30 days)
export const getAvailableInvoices = async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const availableInvoices = mockSales
      .filter((sale: any) => {
        const saleDate = new Date(sale.createdAt);
        return saleDate > thirtyDaysAgo;
      })
      .map((sale: any) => ({
        invoiceId: sale.orderId,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        total: sale.total,
        date: sale.createdAt,
        items: sale.items,
      }));

    return res.json({ success: true, data: availableInvoices });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to fetch invoices" });
  }
};

// Update return refund status (Feature 94 tracking)
export const updateReturnRefund = async (req: Request, res: Response) => {
  try {
    const returnId = normalizeString(req.params.returnId);
    const refundStatus = normalizeString(req.body.refundStatus);

    const returnRecord = salesReturns.find((r: any) => r.returnId === returnId);
    if (!returnRecord) {
      return res.status(404).json({ success: false, error: "Return not found" });
    }

    returnRecord.refundStatus = refundStatus;

    return res.json({ success: true, data: returnRecord });
  } catch (error: any) {
    console.error("Refund update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update refund status" });
  }
};

// Feature 94: Get return reasons report
export const getReturnReasonsReport = async (_req: Request, res: Response) => {
  try {
    const reasonCounts: Record<string, number> = {};
    salesReturns.forEach((ret: any) => {
      reasonCounts[ret.reason] = (reasonCounts[ret.reason] || 0) + 1;
    });

    const report = Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
      percentage: ((count / salesReturns.length) * 100).toFixed(2),
    }));

    return res.json({ 
      success: true, 
      data: { 
        total: salesReturns.length, 
        byReason: report,
        refundStatus: {
          pending: salesReturns.filter((r: any) => r.refundStatus === "PENDING").length,
          completed: salesReturns.filter((r: any) => r.refundStatus === "COMPLETED").length,
        }
      } 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Failed to generate report" });
  }
};

export { salesReturns, exchanges };



