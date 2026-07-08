import mongoose from "mongoose";

const PaymentHistorySchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "SubscriptionPlan" },
    planSlug: { type: String, required: true },                 // denormalized
    planName: { type: String, required: true },                 // denormalized
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreSubscription", default: null },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    method: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "CHEQUE", "RAZORPAY", "BANK_TRANSFER", "OTHER"],
      required: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "PENDING", "REFUNDED", "CANCELLED"],
      default: "PENDING",
      required: true,
    },

    // Gateway / reference details
    referenceId: { type: String, default: "" },                 // cheque no, UPI txn id, Razorpay order id, etc.
    gateway: { type: String, default: "" },                     // "RAZORPAY", "MANUAL", etc.
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    // Invoice linkage
    invoiceId: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },

    // Timing
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    // Meta
    notes: { type: String, default: "" },
    recordedBy: { type: String, default: "super-admin" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "paymenthistories",
  }
);

// Indexes
PaymentHistorySchema.index({ storeId: 1 });
PaymentHistorySchema.index({ storeId: 1, createdAt: -1 });
PaymentHistorySchema.index({ planId: 1 });
PaymentHistorySchema.index({ status: 1 });
PaymentHistorySchema.index({ referenceId: 1 });
PaymentHistorySchema.index({ invoiceId: 1 });

export default PaymentHistorySchema;
