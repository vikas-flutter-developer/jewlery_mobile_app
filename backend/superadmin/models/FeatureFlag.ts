import mongoose from "mongoose";

const FeatureFlagSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },  // e.g. "enableOldGold"
    label: { type: String, required: true, trim: true },              // human-readable name
    description: { type: String, default: "" },
    value: { type: Boolean, required: true, default: false },

    // Scope: GLOBAL applies to all; PLAN applies to stores on a specific plan; STORE applies to a specific store
    scope: {
      type: String,
      enum: ["GLOBAL", "PLAN", "STORE"],
      default: "GLOBAL",
      required: true,
    },
    targetPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan", default: null },
    targetStoreId: { type: String, default: null },

    // Audit
    updatedBy: { type: String, default: "super-admin" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "featureflags",
  }
);

// Indexes
FeatureFlagSchema.index({ key: 1 }, { unique: true });
FeatureFlagSchema.index({ scope: 1 });
FeatureFlagSchema.index({ targetPlanId: 1 });
FeatureFlagSchema.index({ targetStoreId: 1 });

export default FeatureFlagSchema;
