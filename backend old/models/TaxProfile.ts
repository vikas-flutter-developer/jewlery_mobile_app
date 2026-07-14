import mongoose from "mongoose";

const taxProfileSchema = new mongoose.Schema(
  {
    profileName: { type: String, required: true, trim: true },
    taxType: { type: String, default: "GST", trim: true },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    hsnCode: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    tenantId: { type: String, default: "default-shop", index: true }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure profileName is unique per tenant
taxProfileSchema.index({ tenantId: 1, profileName: 1 }, { unique: true });

const TaxProfile = (
  mongoose.models.TaxProfile ||
  mongoose.model("TaxProfile", taxProfileSchema)
) as mongoose.Model<any>;

export default TaxProfile;
