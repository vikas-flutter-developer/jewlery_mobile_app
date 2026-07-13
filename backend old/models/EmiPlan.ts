import mongoose from "mongoose";

const emiInstallmentSchema = new mongoose.Schema(
  {
    installmentNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date },
    status: { type: String, enum: ["PENDING", "PAID", "OVERDUE"], default: "PENDING" },
    paymentMethod: { type: String },
    transactionId: { type: String },
  },
  { _id: false }
);

const emiPlanSchema = new mongoose.Schema(
  {
    emiPlanId: { type: String, required: true, unique: true, index: true },
    invoiceId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    downPayment: { type: Number, required: true, min: 0 },
    emiAmount: { type: Number, required: true, min: 0 },
    numberOfInstallments: { type: Number, required: true, min: 1 },
    frequency: { type: String, enum: ["MONTHLY", "WEEKLY"], default: "MONTHLY" },
    installments: { type: [emiInstallmentSchema], default: [] },
    remainingAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED"],
      default: "ACTIVE",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const EmiPlan =
  (mongoose.models.EmiPlan || mongoose.model("EmiPlan", emiPlanSchema)) as mongoose.Model<any>;

export default EmiPlan;
