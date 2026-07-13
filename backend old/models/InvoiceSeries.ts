import mongoose from "mongoose";

/**
 * InvoiceSeries — tracks auto-increment counter per financial year.
 * One document per (tenantId, prefix, financialYear) combination.
 */
const invoiceSeriesSchema = new mongoose.Schema(
  {
    prefix: { type: String, default: "AJ", required: true },
    financialYear: { type: String, required: true }, // e.g. "2026-27"
    lastSequence: { type: Number, default: 0, required: true },
    padLength: { type: Number, default: 6 }, // zero-pad to 6 digits
    resetOnNewYear: { type: Boolean, default: true },
    tenantId: { type: String, index: true },
  },
  { timestamps: true }
);

// Compound unique index: one counter per tenant + prefix + year
invoiceSeriesSchema.index(
  { tenantId: 1, prefix: 1, financialYear: 1 },
  { unique: true }
);

const InvoiceSeries = (mongoose.models.InvoiceSeries ||
  mongoose.model("InvoiceSeries", invoiceSeriesSchema)) as mongoose.Model<any>;

export default InvoiceSeries;
