import mongoose from "mongoose";

const ReferralCommissionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralLead", required: true },
    referralPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralPartner", required: true, index: true },
    commissionType: { type: String, enum: ["FIXED", "PERCENTAGE"], required: true },
    commissionValue: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    subscriptionAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true
    },
    calculatedAt: { type: Date, default: Date.now },
    remarks: { type: String, default: "" }
  },
  {
    timestamps: true,
    collection: "referralcommissions"
  }
);

// One commission profile per referred lead inside tenant database partition
ReferralCommissionSchema.index({ tenantId: 1, referralId: 1 }, { unique: true });

export default mongoose.models.ReferralCommission || mongoose.model("ReferralCommission", ReferralCommissionSchema);
