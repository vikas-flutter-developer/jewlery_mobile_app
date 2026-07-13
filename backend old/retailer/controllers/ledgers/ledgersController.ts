import { Request, Response } from "express";
import { Khata } from "../../models/index.js";
import { mockKhata } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

const findFallbackLedger = (accountId: string) => {
  const normalizedId = accountId.trim().toLowerCase();

  return mockKhata.find((entry: any) => {
    const entryId = String(entry._id || "").trim().toLowerCase();
    const customerName = String(entry.customerName || "").trim().toLowerCase();
    const customerPhone = String(entry.customerPhone || "").trim().toLowerCase();

    return entryId === normalizedId || customerName === normalizedId || customerPhone === normalizedId;
  });
};

const serializeLedger = (ledger: any) => ({
  accountId: ledger._id,
  customerName: ledger.customerName || "Unknown Customer",
  customerPhone: ledger.customerPhone || null,
  customerAadhar: ledger.customerAadhar || null,
  balance: Number(ledger.balance ?? 0),
  transactions: Array.isArray(ledger.transactions) ? ledger.transactions : [],
  source: isDbConnected() ? "database" : "fallback",
});

export const getLedgerByAccount = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({ success: false, error: "accountId is required" });
    }

    if (!isDbConnected()) {
      const fallbackLedger = findFallbackLedger(accountId);

      if (!fallbackLedger) {
        return res.status(404).json({ success: false, error: "Ledger account not found" });
      }

      return res.json({ success: true, data: serializeLedger(fallbackLedger) });
    }

    const account = await Khata.findById(accountId);

    if (!account) {
      return res.status(404).json({ success: false, error: "Ledger account not found" });
    }

    return res.json({ success: true, data: serializeLedger(account.toObject()) });
  } catch (error) {
    console.error("Failed to fetch ledger account", error);
    return res.status(500).json({ success: false, error: "Failed to fetch ledger account" });
  }
};


