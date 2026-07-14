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
  "TAX_PROFILE_CREATED",
  "TAX_PROFILE_UPDATED",
  "TAX_PROFILE_ACTIVATED",
  "TAX_PROFILE_DEFAULT_CHANGED",
  "TAX_PROFILE_DELETED",
  "MSG_CONFIG_CREATED",
  "MSG_CONFIG_UPDATED",
  "MSG_CONFIG_ACTIVATED",
  "MSG_CONFIG_DEACTIVATED",
  "MSG_CONFIG_TESTED",
  "PAY_GATEWAY_CREATED",
  "PAY_GATEWAY_UPDATED",
  "PAY_GATEWAY_ACTIVATED",
  "PAY_GATEWAY_DEACTIVATED",
  "PAY_GATEWAY_TESTED",
  "PAY_GATEWAY_DEFAULT_CHANGED",
  "PRINTER_CREATED",
  "PRINTER_UPDATED",
  "PRINTER_ACTIVATED",
  "PRINTER_DEACTIVATED",
  "PRINTER_DEFAULT_CHANGED",
  "PRINTER_TEST_PRINTED",
  "TCS_CALCULATED",
  "TCS_UPDATED",
  "TCS_REPORT_GENERATED",
  "PAN_ADDED",
  "PAN_UPDATED",
  "PAN_VERIFIED",
  "PAN_VALIDATION_FAILED",
  "BIS_LICENCE_CREATED",
  "BIS_LICENCE_UPDATED",
  "BIS_LICENCE_ACTIVATED",
  "BIS_LICENCE_SUSPENDED",
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
  "TAX_PROFILE",
  "MESSAGING_CONFIGURATION",
  "PAYMENT_GATEWAY_CONFIGURATION",
  "PRINTER_CONFIGURATION",
  "TCS_TRANSACTION",
  "BIS_LICENCE",
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
