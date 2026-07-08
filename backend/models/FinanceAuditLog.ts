import mongoose from "mongoose";

export const FINANCE_ACTION_TYPES = [
  "INVOICE_CREATED",
  "PAYMENT_COLLECTED",
  "ADVANCE_DEPOSIT",
  "REFUND",
  "REVERSAL",
  "EMI_CREATED",
  "EMI_PAYMENT",
  "SALES_RETURN",
  "BALANCE_ADJUSTMENT",
  "CREDIT_LIMIT_UPDATED",
  "CREDIT_BLOCKED",
  "CREDIT_UNBLOCKED",
  "CUSTOMER_MARKED_VIP",
  "CUSTOMER_REMOVED_VIP",
  "CUSTOMER_BLACKLISTED",
  "CUSTOMER_REMOVED_BLACKLIST",
] as const;

export type FinanceActionType = (typeof FINANCE_ACTION_TYPES)[number];

export const FINANCE_ENTITY_TYPES = [
  "INVOICE",
  "SALE",
  "PAYMENT",
  "CUSTOMER",
  "EMI_PLAN",
  "SALES_RETURN",
  "ADVANCE_DEPOSIT",
] as const;

export type FinanceEntityType = (typeof FINANCE_ENTITY_TYPES)[number];

const financeAuditLogSchema = new mongoose.Schema(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    actionType: { type: String, enum: FINANCE_ACTION_TYPES, required: true, index: true },
    entityType: { type: String, enum: FINANCE_ENTITY_TYPES, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    userName: { type: String },
    role: { type: String },
    previousData: { type: mongoose.Schema.Types.Mixed },
    newData: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

financeAuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
financeAuditLogSchema.index({ actionType: 1, timestamp: -1 });

const FinanceAuditLog =
  (mongoose.models.FinanceAuditLog ||
    mongoose.model("FinanceAuditLog", financeAuditLogSchema)) as mongoose.Model<any>;

export default FinanceAuditLog;
