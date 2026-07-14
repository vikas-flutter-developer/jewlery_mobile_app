import mongoose from "mongoose";

const ReferralPayoutLedgerSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    referralPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralPartner", required: true, index: true },
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralCommission", required: true },
    earnedAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, required: true },
    paymentDate: { type: Date, default: null },
    paymentMethod: { type: String, default: "" },
    referenceNumber: { type: String, default: "" },
    status: {
      type: String,
      enum: ["EARNED", "PARTIALLY_PAID", "PAID", "CANCELLED"],
      default: "EARNED",
      index: true
    },
    remarks: { type: String, default: "" }
  },
  {
    timestamps: true,
    collection: "referralpayoutledgers"
  }
);

// One ledger entry per commission inside tenant database partition
ReferralPayoutLedgerSchema.index({ tenantId: 1, commissionId: 1 }, { unique: true });

export default mongoose.models.ReferralPayoutLedger || mongoose.model("ReferralPayoutLedger", ReferralPayoutLedgerSchema);
