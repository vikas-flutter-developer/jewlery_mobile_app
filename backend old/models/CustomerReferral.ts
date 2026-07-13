import mongoose from "mongoose";

const customerReferralSchema = new mongoose.Schema({
  referrerCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  referredCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, unique: true, index: true },
  referralCode: { type: String, required: true, index: true },
  referralStatus: { 
    type: String, 
    enum: ["PENDING", "QUALIFIED", "REWARDED", "CANCELLED"], 
    default: "PENDING",
    index: true
  },
  rewardType: { type: String, enum: ["POINTS", "AMOUNT"], default: "POINTS" },
  rewardValue: { type: Number, default: 0 },
  rewardStatus: { type: String, enum: ["PENDING", "ISSUED", "REDEEMED", "NONE"], default: "PENDING" },
  qualifyingSaleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const CustomerReferral = mongoose.models.CustomerReferral || mongoose.model("CustomerReferral", customerReferralSchema);
export default CustomerReferral;
export { customerReferralSchema };
