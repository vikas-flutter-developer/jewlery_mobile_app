import mongoose from "mongoose";

const PriceResolutionLogSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER", "PLATINUM"],
      required: true,
      index: true
    },
    purity: { type: String, required: true, index: true },
    transactionDate: { type: Date, required: true, index: true },
    resolvedRate: { type: Number, required: true },
    source: {
      type: String,
      enum: ["CONTRACT_RULE", "PURCHASE_PRICE", "DEFAULT_RATE"],
      required: true,
      index: true
    },
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorRateContract", default: null },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorRateRule", default: null },
    remarks: { type: String, default: "" }
  },
  {
    timestamps: true,
    collection: "priceresolutionlogs"
  }
);

// Export both the model (for standalone use) and a schema-bearing object for retailerDb.model()
const PriceResolutionLogModel = mongoose.models.PriceResolutionLog ||
  mongoose.model("PriceResolutionLog", PriceResolutionLogSchema);

export { PriceResolutionLogSchema };
export default PriceResolutionLogModel;
