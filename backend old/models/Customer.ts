import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, lowercase: true },
  phone: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  pan: { type: String, uppercase: true },
  panNumber: { type: String, uppercase: true, trim: true, index: true },
  panStatus: {
    type: String,
    enum: ["PENDING", "VERIFIED", "INVALID"],
    default: "PENDING",
    index: true,
  },
  panVerifiedAt: { type: Date },
  panVerifiedBy: { type: String },
  tenantId: { type: String, default: "default-shop", index: true },
  aadhar: { type: String },
  gstin: { type: String },
  kycStatus: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING" },
  kycDocuments: [{
    type: { type: String, enum: ["PAN", "AADHAR", "PASSPORT"] },
    documentPath: String,
    uploadedAt: Date
  }],
  creditLimit: { type: Number, default: 0 },
  creditBlocked: { type: Boolean, default: false },
  advanceBalance: { type: Number, default: 0, min: 0 },
  outstandingBalance: { type: Number, default: 0, min: 0 },
  loyaltyPoints: { type: Number, default: 0 },
  totalPurchases: { type: Number, default: 0 },
  customerSince: { type: Date, default: Date.now },
  ledgerAccountId: { type: String },
  loyaltyWalletId: { type: String },
  preferredBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  birthday: { type: Date },
  anniversary: { type: Date },
  referredBy: { type: String },
  customerTier: { type: String, enum: ["REGULAR", "NORMAL", "VIP", "BLACKLISTED"], default: "NORMAL" },
  vipSince: { type: Date },
  blacklistReason: { type: String },
  blacklistDate: { type: Date },
  blacklistedBy: { type: String },
  tierNotes: { type: String },
  tags: { type: [String], default: ["REGULAR"] },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ pan: 1 });
CustomerSchema.index({ tenantId: 1, panNumber: 1 }, { unique: true, sparse: true });

const Customer = (mongoose.models.Customer || mongoose.model("Customer", CustomerSchema)) as mongoose.Model<any>;
export default Customer;
