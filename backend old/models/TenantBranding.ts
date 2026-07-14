import mongoose from "mongoose";

const TenantBrandingSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true },
    logoUrl: { type: String, default: "" },
    faviconUrl: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    gstState: { type: String, default: "" },
    invoicePrefix: { type: String, default: "" },
    invoiceFooter: { type: String, default: "" },
    invoiceTerms: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: "tenantbrandings"
  }
);

export default mongoose.models.TenantBranding || mongoose.model("TenantBranding", TenantBrandingSchema);
