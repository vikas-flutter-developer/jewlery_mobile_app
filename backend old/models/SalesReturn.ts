import mongoose from "mongoose";

const salesReturnSchema = new mongoose.Schema({
  returnId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true, index: true },
  customerId: { type: String, index: true },
  customerName: String,
  customerPhone: String,
  returnType: { type: String, enum: ["FULL", "PARTIAL"], default: "FULL" },
  items: [
    {
      itemId: String,
      quantity: Number,
      reason: String,
      total: Number,
    }
  ],
  status: { type: String, default: "PENDING" },
  refundStatus: { type: String, default: "PENDING" },
  returnAmount: Number,
  refundMethod: { type: String },
  refundTransactionId: { type: String },
  financialProcessed: { type: Boolean, default: false },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const SalesReturn = (mongoose.models.SalesReturn || mongoose.model("SalesReturn", salesReturnSchema)) as mongoose.Model<any>;
export default SalesReturn;
