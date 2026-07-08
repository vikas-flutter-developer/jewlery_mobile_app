import mongoose from "mongoose";

const advanceDepositSchema = new mongoose.Schema(
  {
    depositId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "CARD"], required: true },
    reference: { type: String },
    balanceAfter: { type: Number, required: true, min: 0 },
    note: { type: String },
    ledgerTransactionId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

advanceDepositSchema.index({ customerId: 1, createdAt: -1 });

const AdvanceDeposit =
  (mongoose.models.AdvanceDeposit ||
    mongoose.model("AdvanceDeposit", advanceDepositSchema)) as mongoose.Model<any>;

export default AdvanceDeposit;
