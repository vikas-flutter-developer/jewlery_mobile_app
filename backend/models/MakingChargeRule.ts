import mongoose from "mongoose";

const makingChargeRuleSchema = new mongoose.Schema(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    ruleName: { type: String, required: true, trim: true },
    ruleType: {
      type: String,
      required: true,
      enum: ["GLOBAL", "CATEGORY", "PRODUCT", "CUSTOMER", "BRANCH"],
      index: true,
    },
    metalType: {
      type: String,
      required: true,
      enum: ["GOLD", "SILVER", "PLATINUM", "DIAMOND", "GEMSTONE", "ALL"],
      index: true,
    },
    category: { type: String, default: "", trim: true, index: true },
    subCategory: { type: String, default: "", trim: true },
    purity: { type: String, default: "", trim: true },
    productId: { type: String, default: "", trim: true, index: true },
    customerId: { type: String, default: "", trim: true, index: true },
    branchId: { type: String, default: "", trim: true, index: true },
    calculationMethod: {
      type: String,
      required: true,
      enum: ["PER_GRAM", "FIXED", "PERCENTAGE", "PER_PIECE"],
    },
    value: { type: Number, required: true, min: 0 },
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    priority: { type: Number, required: true, default: 100, index: true },
    isActive: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: "" },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient priority resolution
makingChargeRuleSchema.index({ metalType: 1, category: 1, ruleType: 1, isActive: 1, priority: 1 });
makingChargeRuleSchema.index({ productId: 1, isActive: 1 });
makingChargeRuleSchema.index({ customerId: 1, isActive: 1 });
makingChargeRuleSchema.index({ branchId: 1, isActive: 1 });

const MakingChargeRule = (
  mongoose.models.MakingChargeRule ||
  mongoose.model("MakingChargeRule", makingChargeRuleSchema)
) as mongoose.Model<any>;

export default MakingChargeRule;
