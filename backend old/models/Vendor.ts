import mongoose from "mongoose";

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["BULLION_MERCHANT", "MANUFACTURER", "SERVICE_PROVIDER"], default: "SERVICE_PROVIDER" },
  gstin: { type: String },
  gst: { type: String },
  pan: { type: String },
  email: { type: String },
  phone: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  bank: { type: String },
  bankAccount: { type: String },
  ifscCode: { type: String },
  contactPerson: { type: String },
  notes: { type: String },
  metalAccount: {
    goldBalance: { type: Number, default: 0 }, // in grams
    silverBalance: { type: Number, default: 0 },
    platinumBalance: { type: Number, default: 0 }
  },
  ledgerAccountId: { type: String },
  paymentTerms: { type: String },
  minOrderQty: { type: Number, default: 0 },
  minOrderValue: { type: Number, default: 0 },
  rateContracts: [{
    metalType: { type: String, enum: ["GOLD_24K", "GOLD_22K", "SILVER", "PLATINUM"] },
    lockedRate: { type: Number, required: true },
    validUntil: { type: Date, required: true }
  }],
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

VendorSchema.index({ gstin: 1 });
VendorSchema.index({ phone: 1 });

const Vendor = (mongoose.models.Vendor || mongoose.model("Vendor", VendorSchema)) as mongoose.Model<any>;
export default Vendor;
