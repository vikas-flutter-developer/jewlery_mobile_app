import mongoose from "mongoose";

const designMoodboardAuditLogSchema = new mongoose.Schema(
  {
    logId: { type: String, required: true, unique: true, index: true },
    moodboardId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    action: { type: String, enum: ["UPLOAD", "UPDATE", "DELETE", "DOWNLOAD"], required: true, index: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
    userRole: { type: String },
    details: { type: String },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

const DesignMoodboardAuditLog = (mongoose.models.DesignMoodboardAuditLog || mongoose.model("DesignMoodboardAuditLog", designMoodboardAuditLogSchema)) as mongoose.Model<any>;
export default DesignMoodboardAuditLog;
