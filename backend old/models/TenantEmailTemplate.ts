import mongoose from "mongoose";

const TenantEmailTemplateSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    templateType: { type: String, enum: ["INVOICE", "OTP", "NOTIFICATION"], required: true, index: true },
    senderName: { type: String, required: true },
    logoUrl: { type: String, default: "" },
    footerText: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: "tenantemailtemplates"
  }
);

// Compounding unique index to ensure one active template per type per tenant
TenantEmailTemplateSchema.index({ tenantId: 1, templateType: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.models.TenantEmailTemplate || mongoose.model("TenantEmailTemplate", TenantEmailTemplateSchema);
