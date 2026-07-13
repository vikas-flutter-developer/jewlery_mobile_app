import mongoose from "mongoose";

const StoreSubscriptionSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true },                  // references existing store's custom `id` field
    planId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "SubscriptionPlan" },
    planSlug: { type: String, required: true },                 // denormalized for fast reads
    planName: { type: String, required: true },                 // denormalized for fast reads
    status: {
      type: String,
      enum: ["ACTIVE", "TRIAL", "EXPIRED", "SUSPENDED", "PENDING", "CANCELLED"],
      default: "PENDING",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    trialEndsAt: { type: Date, default: null },
    autoRenew: { type: Boolean, default: false },

    // Lifecycle timestamps
    suspendedAt: { type: Date, default: null },
    suspendReason: { type: String, default: "" },
    reactivatedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    lastRenewedAt: { type: Date, default: null },

    // Tracking
    assignedBy: { type: String, default: "super-admin" },       // actor who assigned the plan
    notes: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "storesubscriptions",
  }
);

// Indexes
StoreSubscriptionSchema.index({ storeId: 1 });
StoreSubscriptionSchema.index({ storeId: 1, status: 1 });
StoreSubscriptionSchema.index({ planId: 1 });
StoreSubscriptionSchema.index({ status: 1 });
StoreSubscriptionSchema.index({ endDate: 1 });
StoreSubscriptionSchema.index({ trialEndsAt: 1 });

export default StoreSubscriptionSchema;
