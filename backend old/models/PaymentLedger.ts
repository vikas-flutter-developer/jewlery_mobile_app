import mongoose from "mongoose";

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "ADVANCE_BALANCE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LEDGER_ENTRY_TYPES = [
  "INVOICE_PAYMENT",
  "ADVANCE_DEPOSIT",
  "ADVANCE_USED",
  "EMI_DOWN_PAYMENT",
  "EMI_INSTALLMENT",
  "OUTSTANDING_ADJUSTMENT",
  "REFUND",
  "REVERSAL",
  "SALES_RETURN",
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

const paymentSplitSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String },
  },
  { _id: false }
);

const paymentLedgerSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    invoiceId: { type: String, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String },
    entryType: { type: String, enum: LEDGER_ENTRY_TYPES, required: true },
    payments: { type: [paymentSplitSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    invoiceTotal: { type: Number },
    outstandingBefore: { type: Number, default: 0 },
    outstandingAfter: { type: Number, default: 0 },
    advanceBalanceBefore: { type: Number, default: 0 },
    advanceBalanceAfter: { type: Number, default: 0 },
    note: { type: String },
    status: { type: String, enum: ["COMPLETED", "PENDING", "REVERSED"], default: "COMPLETED" },
    reversalOf: { type: String, index: true },
    reversedBy: { type: String, index: true },
    refundReason: { type: String },
    relatedEntityType: { type: String },
    relatedEntityId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentLedgerSchema.index({ customerId: 1, createdAt: -1 });
paymentLedgerSchema.index({ invoiceId: 1, createdAt: -1 });

const PaymentLedger =
  (mongoose.models.PaymentLedger ||
    mongoose.model("PaymentLedger", paymentLedgerSchema)) as mongoose.Model<any>;

export default PaymentLedger;
