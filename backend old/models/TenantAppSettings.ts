import mongoose from "mongoose";

const TenantAppSettingsSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    appName: { type: String, required: true },
    appIconUrl: { type: String, default: "" },
    splashScreenUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: "tenantappsettings"
  }
);

// Compounding unique index to ensure one active profile per tenant
TenantAppSettingsSchema.index({ tenantId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.models.TenantAppSettings || mongoose.model("TenantAppSettings", TenantAppSettingsSchema);
