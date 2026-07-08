import { Request, Response } from "express";
import { LedgerHistory } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

// ─── In-memory fallback ──────────────────────────────────────────────────────
const mockLedger: any[] = [
  {
    _id: "ledg_001",
    transactionId: "TXN-LEDG-0001",
    customerId: "cust_portal_1",
    customerPhone: "9999999999",
    category: "SCHEME_EMI",
    title: "Scheme Installment #5",
    description: "Monthly installment for Aura Suvarna Vriddhi Savings Scheme",
    amount: 5000,
    goldGrams: 0.82,
    paymentMethod: "UPI",
    status: "CLEARED",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "ledg_002",
    transactionId: "TXN-LEDG-0002",
    customerId: "cust_portal_1",
    customerPhone: "9999999999",
    category: "STORE_PURCHASE",
    title: "Store Purchase - Gold Bangles",
    description: "22K gold bangle pair purchased at Aura Jewel Mumbai",
    amount: 45000,
    goldGrams: 7.2,
    paymentMethod: "Card",
    status: "CLEARED",
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "ledg_003",
    transactionId: "TXN-LEDG-0003",
    customerId: "cust_portal_1",
    customerPhone: "9999999999",
    category: "BESPOKE_BOOKING",
    title: "Bespoke Order Booking - Kerala Jhumka",
    description: "Advanced booking for custom Kerala-style Jhumka Earrings with ruby details",
    amount: 10000,
    goldGrams: 0,
    paymentMethod: "NetBanking",
    status: "CLEARED",
    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── GET ledger history by customer phone ────────────────────────────────────
export const getLedgerByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const { category, limit = "50" } = req.query;

    let entries: any[];
    if (isDbConnected()) {
      const filter: any = { customerPhone: phone };
      if (category) filter.category = String(category);
      entries = await LedgerHistory.find(filter)
        .sort({ date: -1 })
        .limit(parseInt(String(limit)))
        .lean();
    } else {
      entries = mockLedger.filter((l) => l.customerPhone === phone);
      if (category) entries = entries.filter((l) => l.category === String(category));
      entries = entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return res.json({ success: true, data: entries, total: entries.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET ALL ledger entries (admin view) ─────────────────────────────────────
export const getAllLedgerEntries = async (req: Request, res: Response) => {
  try {
    const { category, limit = "100" } = req.query;
    let entries: any[];
    if (isDbConnected()) {
      const filter: any = {};
      if (category) filter.category = String(category);
      entries = await LedgerHistory.find(filter)
        .sort({ date: -1 })
        .limit(parseInt(String(limit)))
        .lean();
    } else {
      entries = mockLedger;
      if (category) entries = entries.filter((l) => l.category === String(category));
    }
    return res.json({ success: true, data: entries, total: entries.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── ADD a ledger entry ───────────────────────────────────────────────────────
export const addLedgerEntry = async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      customerPhone,
      category,
      title,
      description,
      amount,
      goldGrams,
      paymentMethod,
      status,
    } = req.body;

    if (!customerPhone || !category || !amount) {
      return res.status(400).json({
        success: false,
        error: "customerPhone, category, and amount are required.",
      });
    }

    const transactionId = `TXN-LEDG-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const entry = {
      transactionId,
      customerId: customerId || customerPhone,
      customerPhone,
      category,
      title: title || category,
      description: description || "",
      amount: Number(amount),
      goldGrams: Number(goldGrams || 0),
      paymentMethod: paymentMethod || "UPI",
      status: status || "CLEARED",
      date: new Date(),
    };

    if (isDbConnected()) {
      const created = await LedgerHistory.create(entry);
      return res.status(201).json({ success: true, data: created });
    } else {
      const saved = { _id: `ledg_${Date.now()}`, ...entry, date: entry.date.toISOString() };
      mockLedger.push(saved);
      return res.status(201).json({ success: true, data: saved });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET ledger summary (total spent, gold accumulated) ──────────────────────
export const getLedgerSummary = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    let entries: any[];

    if (isDbConnected()) {
      entries = await LedgerHistory.find({ customerPhone: phone, status: "CLEARED" }).lean();
    } else {
      entries = mockLedger.filter((l) => l.customerPhone === phone && l.status === "CLEARED");
    }

    const totalSpent = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalGold = entries.reduce((sum, e) => sum + (e.goldGrams || 0), 0);
    const schemePayments = entries.filter((e) => e.category === "SCHEME_EMI").length;
    const storePurchases = entries.filter((e) => e.category === "STORE_PURCHASE").length;
    const bespokeOrders = entries.filter((e) => e.category === "BESPOKE_BOOKING").length;

    return res.json({
      success: true,
      data: {
        totalTransactions: entries.length,
        totalSpent,
        totalGoldGrams: parseFloat(totalGold.toFixed(3)),
        schemePayments,
        storePurchases,
        bespokeOrders,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
