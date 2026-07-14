import mongoose from "mongoose";

const VendorRateContractSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    contractNumber: { type: String, required: true, unique: true, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    metalType: { type: String, enum: ["GOLD", "SILVER", "PLATINUM"], required: true, index: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"],
      default: "DRAFT",
      index: true
    },
    remarks: { type: String, default: "" },
    createdBy: { type: String, required: true }
  },
  {
    timestamps: true,
    collection: "vendorratecontracts"
  }
);

export default mongoose.models.VendorRateContract || mongoose.model("VendorRateContract", VendorRateContractSchema);
