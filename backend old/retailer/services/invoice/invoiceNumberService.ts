import { InvoiceSeries, FinancialYear } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

/**
 * Returns the current Indian financial year string.
 * e.g. for dates Apr 2026 – Mar 2027 → "2026-27"
 */
export async function getCurrentFinancialYear(): Promise<string> {
  if (isDbConnected()) {
    try {
      const active = await FinancialYear.findOne({ status: "ACTIVE" }).lean();
      if (active && active.code) {
        return active.code;
      }
    } catch (err) {
      console.error("[getCurrentFinancialYear] Failed to query DB:", err);
    }
  }

  const now = new Date();
  const month = now.getMonth(); // 0 = Jan
  const year = now.getFullYear();

  if (month >= 3) {
    // April or later → FY starts this calendar year
    return `${year}-${String(year + 1).slice(-2)}`;
  }
  // Jan–Mar → FY started previous calendar year
  return `${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Atomically increments the sequence counter and returns the next
 * formatted invoice number, e.g. "AJ/2026-27/000001".
 *
 * Uses findOneAndUpdate with $inc + upsert to be safe under concurrency.
 */
export async function getNextInvoiceNumber(
  tenantId: string,
  prefix = "AJ",
  financialYear?: string
): Promise<string> {
  const fy = financialYear || await getCurrentFinancialYear();

  const updated = await InvoiceSeries.findOneAndUpdate(
    { tenantId, prefix, financialYear: fy },
    {
      $inc: { lastSequence: 1 },
      $setOnInsert: { padLength: 6, resetOnNewYear: true },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const seq: number = updated?.lastSequence ?? 1;
  const padLen: number = updated?.padLength ?? 6;
  const padded = String(seq).padStart(padLen, "0");

  return `${prefix}/${fy}/${padded}`;
}

/**
 * Peek at the current series config without incrementing.
 */
export async function getSeriesConfig(tenantId: string) {
  const fy = await getCurrentFinancialYear();
  const doc = await InvoiceSeries.findOne({ tenantId, financialYear: fy }).lean();
  return doc || { prefix: "AJ", financialYear: fy, lastSequence: 0, padLength: 6 };
}

/**
 * Update series settings (prefix, padLength, reset sequence).
 */
export async function updateSeriesConfig(
  tenantId: string,
  updates: {
    prefix?: string;
    padLength?: number;
    resetSequence?: boolean;
  }
) {
  const fy = await getCurrentFinancialYear();
  const setFields: Record<string, unknown> = {};
  if (updates.prefix !== undefined) setFields.prefix = updates.prefix;
  if (updates.padLength !== undefined) setFields.padLength = updates.padLength;
  if (updates.resetSequence) setFields.lastSequence = 0;

  const doc = await InvoiceSeries.findOneAndUpdate(
    { tenantId, financialYear: fy },
    { $set: setFields },
    { upsert: true, new: true }
  );
  return doc;
}
