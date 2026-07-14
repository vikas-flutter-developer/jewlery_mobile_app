import mongoose from "mongoose";

const TenantThemeSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    primaryColor: { type: String, default: "#0f172a" },
    secondaryColor: { type: String, default: "#475569" },
    accentColor: { type: String, default: "#fbbf24" },
    loginBannerUrl: { type: String, default: "" },
    loginBackgroundUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: "tenantthemes"
  }
);

export default mongoose.models.TenantTheme || mongoose.model("TenantTheme", TenantThemeSchema);
