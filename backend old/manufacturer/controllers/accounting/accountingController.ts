import { Request, Response } from "express";
import {
  ManufacturerKhata,
  ManufacturerAccountingEntry,
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

// ─── Khata / Ledger ──────────────────────────────────────────────────────────

export const getManufacturerKhata = async (_req: Request, res: Response) => {
  try {
    const ledgers = await ManufacturerKhata.find().lean();
    return res.json({ success: true, data: ledgers });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer khata records");
  }
};

export const addManufacturerKhataEntry = async (req: Request, res: Response) => {
  try {
    // 1. Check if req.body is a full Khata account payload containing "transactions" array
    if (req.body.transactions && Array.isArray(req.body.transactions)) {
      // Find if an account already exists for this customer phone/name
      const phone = normalizeString(req.body.customerPhone);
      const name = normalizeString(req.body.customerName);
      const existing = await ManufacturerKhata.findOne({
        $or: [
          ...(phone ? [{ customerPhone: phone }] : []),
          ...(name ? [{ customerName: name }] : [])
        ]
      });

      if (existing) {
        // Append the new transactions and update balance
        existing.transactions.push(...req.body.transactions);
        existing.balance = (existing.balance || 0) + (req.body.balance || 0);
        if (req.body.customerAadhar) existing.customerAadhar = req.body.customerAadhar;
        await existing.save();
        return res.status(201).json({ success: true, data: existing, message: "Manufacturer khata updated" });
      }

      // If no existing account, save new one
      const ledger = new ManufacturerKhata(req.body);
      await ledger.save();
      return res.status(201).json({ success: true, data: ledger, message: "Manufacturer khata created" });
    }

    // 2. Fallback to existing single entry format
    const entry = {
      type: normalizeString(req.body.type).toUpperCase() || "CREDIT",
      amount: Number(req.body.amount) || 0,
      note: normalizeString(req.body.note),
      date: req.body.date ? new Date(req.body.date) : new Date(),
    };

    if (!entry.amount) {
      return res.status(400).json({ success: false, error: "Khata entry amount is required" });
    }

    const ledger = await ManufacturerKhata.findOneAndUpdate(
      { customerName: normalizeString(req.body.customerName) },
      {
        $setOnInsert: {
          customerName: normalizeString(req.body.customerName),
          customerPhone: normalizeString(req.body.customerPhone),
          customerAadhar: normalizeString(req.body.customerAadhar),
        },
        $push: { transactions: entry },
        $inc: { balance: entry.type === "DEBIT" ? -entry.amount : entry.amount },
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, data: ledger, message: "Manufacturer khata updated" });
  } catch (error) {
    return respondError(res, error, "Failed to record manufacturer khata entry");
  }
};

export const updateManufacturerKhata = async (req: Request, res: Response) => {
  try {
    const updated = await ManufacturerKhata.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, error: "Khata account not found" });
    }
    return res.json({ success: true, data: updated, message: "Manufacturer khata updated" });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer khata account");
  }
};

// ─── Double-Entry Accounting ─────────────────────────────────────────────────

export const postManufacturerJournal = async (req: Request, res: Response) => {
  try {
    const lines = Array.isArray(req.body.entries) ? req.body.entries : [req.body];
    const journalId = normalizeString(req.body.journalId) || generateId("JRN");
    const entries = lines.map((line: any) => ({
      journalId,
      account: normalizeString(line.account),
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      description: normalizeString(line.description),
      reference: normalizeString(line.reference),
      createdAt: new Date(),
    }));
    await ManufacturerAccountingEntry.insertMany(entries);
    return res.status(201).json({ success: true, data: entries, message: "Manufacturer journal posted" });
  } catch (error) {
    return respondError(res, error, "Failed to post manufacturer journal");
  }
};

export const getManufacturerTrialBalance = async (_req: Request, res: Response) => {
  try {
    const entries = await ManufacturerAccountingEntry.find().lean();
    const balances: Record<string, { account: string; debit: number; credit: number; balance: number }> = {};

    entries.forEach((entry) => {
      const account = normalizeString(entry.account);
      if (!balances[account]) {
        balances[account] = { account, debit: 0, credit: 0, balance: 0 };
      }
      balances[account].debit += Number(entry.debit || 0);
      balances[account].credit += Number(entry.credit || 0);
      balances[account].balance = balances[account].debit - balances[account].credit;
    });

    return res.json({ success: true, data: Object.values(balances) });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer trial balance");
  }
};
