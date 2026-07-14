import mongoose from "mongoose";

const VendorRateRuleSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorRateContract", required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    metalType: { type: String, enum: ["GOLD", "SILVER", "PLATINUM"], required: true, index: true },
    purity: { type: String, required: true, index: true },
    rateType: {
      type: String,
      enum: ["FIXED_RATE", "MARKET_PLUS", "MARKET_MINUS"],
      required: true
    },
    rateValue: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "EXPIRED"],
      default: "INACTIVE",
      index: true
    }
  },
  {
    timestamps: true,
    collection: "vendorraterules"
  }
);

export default mongoose.models.VendorRateRule || mongoose.model("VendorRateRule", VendorRateRuleSchema);
