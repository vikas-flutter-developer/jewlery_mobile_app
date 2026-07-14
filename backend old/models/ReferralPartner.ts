import mongoose from "mongoose";

const ReferralPartnerSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    partnerCode: { type: String, required: true, unique: true, index: true },
    partnerType: { type: String, enum: ["REFERRAL_PARTNER", "AGENT", "CONSULTANT"], required: true },
    name: { type: String, required: true },
    companyName: { type: String, default: "" },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "BLOCKED"], default: "ACTIVE", index: true },
    joinedDate: { type: Date, default: Date.now },
    remarks: { type: String, default: "" }
  },
  {
    timestamps: true,
    collection: "referralpartners"
  }
);

// Unique email and mobile constraints per tenant/store partition
ReferralPartnerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
ReferralPartnerSchema.index({ tenantId: 1, mobile: 1 }, { unique: true });

export default mongoose.models.ReferralPartner || mongoose.model("ReferralPartner", ReferralPartnerSchema);
