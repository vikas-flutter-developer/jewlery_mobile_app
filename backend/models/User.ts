import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String }, // null for OAuth users
  phone: { type: String },
  role: { 
    type: String, 
    enum: ["ADMIN", "ACCOUNTANT", "SALES_STAFF", "SALES", "STORE_MANAGER", "KARIKAR", "CUSTOMER", "RETAILER", "SUPER_ADMIN"],
    default: "CUSTOMER"
  },
  branchId: { type: String, trim: true, index: true },
  tenantId: { type: String },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED", "INACTIVE"], default: "ACTIVE" },
  oauthProvider: { type: String, enum: ["GOOGLE", "JWT"], default: "JWT" },
  oauthId: { type: String },
  permissions: [{ type: String }],
  lastLogin: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
  sessions: [{
    jti: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    ip: { type: String },
    device: { type: String }
  }],
  shiftHistory: [{
    type: { type: String, enum: ["clock-in", "clock-out"] },
    timestamp: { type: Date, default: Date.now },
  }],
  shiftSchedule: {
    days: [{ type: String }],
    timeStart: { type: String },
    timeEnd: { type: String },
    shiftName: { type: String, default: "General Shift" }
  },
  salesTarget: { type: Number, default: 100000 },
  commissionRate: { type: Number, default: 1.0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.index({ email: 1 });
UserSchema.index({ branchId: 1, role: 1 });

const User = (mongoose.models.User || mongoose.model("User", UserSchema)) as mongoose.Model<any>;
export default User;
