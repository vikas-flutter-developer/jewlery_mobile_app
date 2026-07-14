import mongoose from "mongoose";

const TenantDomainSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    domain: { type: String, required: true, unique: true, index: true, lowercase: true },
    status: { type: String, enum: ["PENDING", "VERIFIED", "FAILED"], default: "PENDING" },
    verificationToken: { type: String, required: true },
    sslStatus: { type: String, enum: ["PENDING", "ACTIVE", "FAILED"], default: "PENDING" },
    verifiedAt: { type: Date },
    sslExpiredAt: { type: Date },
    createdBy: { type: String }
  },
  {
    timestamps: true,
    collection: "tenantdomains"
  }
);

export default mongoose.models.TenantDomain || mongoose.model("TenantDomain", TenantDomainSchema);
