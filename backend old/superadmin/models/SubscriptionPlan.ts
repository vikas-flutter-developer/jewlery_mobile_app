import mongoose from "mongoose";

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },           // INR
    durationMonths: { type: Number, required: true, min: 1 },
    features: { type: [String], default: [] },                  // human-readable feature list
    maxUsers: { type: Number, default: 5 },
    maxBranches: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    isTrial: { type: Boolean, default: false },
    trialDays: { type: Number, default: 0 },                    // relevant only if isTrial = true
    sortOrder: { type: Number, default: 0 },                    // display ordering
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "subscriptionplans",
  }
);

// Indexes
SubscriptionPlanSchema.index({ slug: 1 }, { unique: true });
SubscriptionPlanSchema.index({ isActive: 1 });
SubscriptionPlanSchema.index({ sortOrder: 1 });

export default SubscriptionPlanSchema;
