import mongoose from "mongoose";

const installmentSchema = new mongoose.Schema(
  {
    installmentId: { type: String, required: true },
    enrollmentId: { type: String, required: true, index: true },
    customerId: String,
    customerPhone: String,
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
    status: { type: String, default: "PAID" },
    paymentMethod: String,
    transactionId: String,
    goldGramsAccumulated: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

const Installment = mongoose.models.Installment || mongoose.model("Installment", installmentSchema, "installments");
export default Installment;
