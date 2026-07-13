import { Schema, model } from "mongoose";

export interface ICustomerAccount {
  customerId: string;
  phone: string;
  name: string;
  status: string;
  lastLogin: Date;
}

const customerAccountSchema = new Schema<ICustomerAccount>(
  {
    customerId: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    lastLogin: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default model<ICustomerAccount>("CustomerAccount", customerAccountSchema);
