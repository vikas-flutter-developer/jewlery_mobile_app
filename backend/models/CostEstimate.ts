import mongoose from "mongoose";

const costEstimateLineItemSchema = new mongoose.Schema(
  {
    description: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const costEstimateSchema = new mongoose.Schema(
  {
    estimateId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    designId: { type: String, required: true, index: true },
    estimateNumber: { type: Number, required: true, default: 1, index: true },
    previousEstimateId: { type: String, default: null },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "DECLINED"],
      default: "SUBMITTED",
      index: true,
    },
    metalCost: { type: Number, default: 0 },
    stoneCost: { type: Number, default: 0 },
    makingCharges: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 3 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    lineItems: { type: [costEstimateLineItemSchema], default: [] },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

costEstimateSchema.index({ orderId: 1, designId: 1, estimateNumber: 1 }, { unique: true });

const CostEstimate = (mongoose.models.CostEstimate || mongoose.model("CostEstimate", costEstimateSchema)) as mongoose.Model<any>;
export default CostEstimate;
