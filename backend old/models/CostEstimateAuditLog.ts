import mongoose from "mongoose";

const costEstimateAuditLogSchema = new mongoose.Schema(
  {
    logId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    designId: { type: String, required: true, index: true },
    estimateId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ["ESTIMATE_CREATE", "ESTIMATE_SUBMIT", "ESTIMATE_APPROVE", "ESTIMATE_DECLINE"],
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
    userRole: { type: String },
    details: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

const CostEstimateAuditLog = (mongoose.models.CostEstimateAuditLog || mongoose.model("CostEstimateAuditLog", costEstimateAuditLogSchema)) as mongoose.Model<any>;
export default CostEstimateAuditLog;
