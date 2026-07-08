import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  phone: { type: String },
  email: { type: String },
  managerName: { type: String },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isMainBranch: { type: Boolean, default: false },
  ipWhitelist: [{ type: String }],
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

BranchSchema.index({ code: 1 });
BranchSchema.index({ managerId: 1 });

const Branch = (mongoose.models.Branch || mongoose.model("Branch", BranchSchema)) as mongoose.Model<any>;
export default Branch;
