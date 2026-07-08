import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  shopName: { type: String, required: true },
  ownerName: { type: String, default: "Owner" },
  email: { type: String, required: true, lowercase: true },
  phone: { type: String, required: true },
  password: { type: String, default: "" },
  gstNumber: { type: String, default: "" },
  panNumber: { type: String, default: "" },
  aadharNumber: { type: String, default: "" },
  address: { type: String, default: "" },
  planName: { type: String, default: "1YEAR" },
  status: { 
    type: String, 
    enum: ["ACTIVE", "EXPIRED", "TRIAL", "PENDING", "SUSPENDED"], 
    default: "PENDING" 
  },
  paymentMethod: { 
    type: String, 
    enum: ["CASH", "CHECK", "UPI", "CARD"], 
    default: "UPI" 
  },
  paymentStatus: { 
    type: String, 
    enum: ["PAID", "DUE", "FAILED"], 
    default: "DUE" 
  },
  subscriptionExpiry: { type: String, required: true },
  joinDate: { type: String, required: true },
  lastLogin: { type: String },
  reminderCount: { type: Number, default: 0 },
  lastReminderAt: { type: String },
  note: { type: String, default: "" },
  storeType: { type: String, enum: ["MANUFACTURER", "RETAILER"], default: "RETAILER" },
  updatedAt: { type: String, required: true }
});

export default SubscriptionSchema;
