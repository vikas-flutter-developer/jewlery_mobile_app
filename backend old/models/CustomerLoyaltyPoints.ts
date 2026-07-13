import { Schema, model } from "mongoose";

export interface ILoyaltyHistory {
  pointsAdded: number;
  reason: string;
  date: Date;
}

export interface ICustomerLoyaltyPoints {
  customerId: string;
  customerPhone: string;
  points: number;
  history: ILoyaltyHistory[];
}

const customerLoyaltyPointsSchema = new Schema<ICustomerLoyaltyPoints>(
  {
    customerId: { type: String, required: true },
    customerPhone: { type: String, required: true },
    points: { type: Number, default: 0 },
    history: [
      {
        pointsAdded: { type: Number, required: true },
        reason: { type: String, required: true },
        date: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

export default model<ICustomerLoyaltyPoints>("CustomerLoyaltyPoints", customerLoyaltyPointsSchema);
