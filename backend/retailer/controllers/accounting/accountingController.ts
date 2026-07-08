import { Request, Response } from "express";

export type JournalLine = {
  id: string;
  account: string;
  debit: number;
  credit: number;
  description?: string;
  reference?: string;
  createdAt: string;
};

const journalStore: JournalLine[] = [];

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeJournalLine = (line: any, index: number): JournalLine => {
  if (!line || typeof line !== "object") {
    throw new Error(`journal entries[${index}] must be an object`);
  }

  const account = String(line.account || line.accountName || "").trim();
  if (!account) {
    throw new Error(`journal entries[${index}].account is required`);
  }

  const debit = roundToTwo(Math.max(0, toNumber(line.debit, 0)));
  const credit = roundToTwo(Math.max(0, toNumber(line.credit, 0)));

  if (debit === 0 && credit === 0) {
    throw new Error(`journal entries[${index}] must have a positive debit or credit amount`);
  }

  if (debit > 0 && credit > 0) {
    throw new Error(`journal entries[${index}] must not include both debit and credit`);
  }

  return {
    id: `JRN-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    account,
    debit,
    credit,
    description: line.description ? String(line.description) : undefined,
    reference: line.reference ? String(line.reference) : undefined,
    createdAt: new Date().toISOString(),
  };
};

const normalizePayload = (req: Request) => {
  const body = req.body ?? {};

  if (Array.isArray(body.entries)) {
    return body.entries.map((entry: any, index: number) => normalizeJournalLine(entry, index));
  }

  const account = String(body.account || body.accountName || "").trim();
  if (!account) {
    throw new Error("account is required");
  }

  const debit = roundToTwo(Math.max(0, toNumber(body.debit, 0)));
  const credit = roundToTwo(Math.max(0, toNumber(body.credit, 0)));

  if (debit === 0 && credit === 0) {
    throw new Error("debit or credit must be a positive number");
  }

  if (debit > 0 && credit > 0) {
    throw new Error("debit and credit cannot both be positive");
  }

  return [
    {
      id: `JRN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      account,
      debit,
      credit,
      description: body.description ? String(body.description) : undefined,
      reference: body.reference ? String(body.reference) : undefined,
      createdAt: new Date().toISOString(),
    },
  ];
};

export const postJournal = async (req: Request, res: Response) => {
  try {
    const entries = normalizePayload(req);
    journalStore.push(...entries);

    return res.status(201).json({
      success: true,
      message: "Journal posted",
      data: entries,
    });
  } catch (error: any) {
    const statusCode = error?.message?.includes("required") || error?.message?.includes("must") ? 400 : 500;
    return res.status(statusCode).json({ error: error.message || "Failed to post journal" });
  }
};

export const getTrialBalance = async (_req: Request, res: Response) => {
  try {
    const aggregated = new Map<string, { account: string; debit: number; credit: number; balance: number }>();

    for (const entry of journalStore) {
      const existing = aggregated.get(entry.account) ?? { account: entry.account, debit: 0, credit: 0, balance: 0 };
      existing.debit = roundToTwo(existing.debit + entry.debit);
      existing.credit = roundToTwo(existing.credit + entry.credit);
      existing.balance = roundToTwo(existing.debit - existing.credit);
      aggregated.set(entry.account, existing);
    }

    const data = Array.from(aggregated.values()).sort((a, b) => a.account.localeCompare(b.account));

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch trial balance" });
  }
};


