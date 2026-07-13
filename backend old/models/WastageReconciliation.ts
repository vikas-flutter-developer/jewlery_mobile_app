import mongoose from "mongoose";

const wastageReconciliationSchema = new mongoose.Schema({
  reconciliationId: { type: String, required: true, unique: true, index: true },
  karikarId: { type: String, required: true, index: true },
  jobId: { type: String },
  orderId: { type: String },
  requestedWeight: { type: Number, required: true, default: 0 },
  purity: { type: String, default: "22K" },
  scrapWeight: { type: Number, default: 0 },
  estimatedWastage: { type: Number, default: 0 },
  actualWastage: { type: Number, default: 0 },
  calculatedLoss: { type: Number, default: 0 },
  requestedBy: { type: String, default: "KARIKAR" },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"],
    default: "PENDING",
  },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const WastageReconciliation = (mongoose.models.WastageReconciliation || mongoose.model("WastageReconciliation", wastageReconciliationSchema)) as mongoose.Model<any>;
export default WastageReconciliation;
