import mongoose from "mongoose";

export const COMPLIANCE_ACTION_TYPES = [
  "INVOICE_COMPLIANCE_CHECK",
  "PAN_VALIDATION",
  "TCS_CALCULATED",
  "BIS_CERTIFICATE_ADDED",
  "BIS_CERTIFICATE_EXPIRED",
  "BIS_VALIDATION",
  "FORM60_LINKED",
] as const;

export type ComplianceActionType = (typeof COMPLIANCE_ACTION_TYPES)[number];

export const COMPLIANCE_STATUS = ["PASSED", "FAILED", "WARNING"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUS)[number];

const complianceLogSchema = new mongoose.Schema(
  {
    logId: { type: String, required: true, unique: true, index: true },
    actionType: { type: String, enum: COMPLIANCE_ACTION_TYPES, required: true, index: true },
    status: { type: String, enum: COMPLIANCE_STATUS, required: true, index: true },
    entityType: { type: String, enum: ["INVOICE", "SALE", "INVENTORY", "CUSTOMER"], required: true },
    entityId: { type: String, required: true, index: true },
    message: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    invoiceTotal: { type: Number },
    customerPan: { type: String },
    tcsAmount: { type: Number },
    userId: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

complianceLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

const ComplianceLog =
  (mongoose.models.ComplianceLog ||
    mongoose.model("ComplianceLog", complianceLogSchema)) as mongoose.Model<any>;

export default ComplianceLog;
