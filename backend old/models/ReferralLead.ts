import mongoose from "mongoose";

const ReferralLeadSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    referralPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralPartner", required: true, index: true },
    referredStoreName: { type: String, required: true },
    ownerName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    source: { type: String, default: "Direct" },
    status: {
      type: String,
      enum: ["LEAD", "CONTACTED", "DEMO_SCHEDULED", "NEGOTIATION", "CONVERTED", "LOST"],
      default: "LEAD",
      index: true
    },
    convertedTenantId: { type: String, default: null, index: true },
    conversionDate: { type: Date, default: null },
    remarks: { type: String, default: "" }
  },
  {
    timestamps: true,
    collection: "referralleads"
  }
);

// Uniqueness rules per tenant partition
ReferralLeadSchema.index({ tenantId: 1, email: 1 }, { unique: true });
ReferralLeadSchema.index({ tenantId: 1, mobile: 1 }, { unique: true });

export default mongoose.models.ReferralLead || mongoose.model("ReferralLead", ReferralLeadSchema);
