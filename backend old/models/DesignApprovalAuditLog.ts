import mongoose from "mongoose";

const designApprovalAuditLogSchema = new mongoose.Schema(
  {
    logId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    designId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ["SUBMIT", "APPROVE", "REJECT", "REQUEST_CHANGES", "REVISION_CREATE", "REVISION_SUBMIT", "REVISION_APPROVE", "REVISION_REJECT"],
      required: true,
      index: true
    },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
    userRole: { type: String },
    details: { type: String },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

const DesignApprovalAuditLog = (mongoose.models.DesignApprovalAuditLog || mongoose.model("DesignApprovalAuditLog", designApprovalAuditLogSchema)) as mongoose.Model<any>;
export default DesignApprovalAuditLog;
