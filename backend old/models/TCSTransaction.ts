import mongoose from "mongoose";

const tcsTransactionSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    financialYearId: {
      type: String,
      required: true,
      index: true,
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    tcsRate: {
      type: Number,
      required: true,
      min: 0,
    },
    tcsAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COLLECTED", "REPORTED"],
      default: "PENDING",
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    tenantId: {
      type: String,
      default: "default-shop",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate TCS entries per tenant + invoice
tcsTransactionSchema.index({ tenantId: 1, invoiceId: 1 }, { unique: true });

const TCSTransaction =
  mongoose.models.TCSTransaction ||
  mongoose.model("TCSTransaction", tcsTransactionSchema);

export default TCSTransaction;
