import { Schema, model } from "mongoose";

interface IOldGoldExchange {
  exchangeId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  exchangeDate: Date;
  oldGoldSubmitted: {
    weight: number;
    purity: string;
    condition: string;
    description: string;
  };
  evaluatedValue: number;
  newGoldPurchased: {
    itemId: string;
    itemName: string;
    weight: number;
    cost: number;
  };
  amountPaid: number;
  paymentMethod: string;
  status: string;
}

const oldGoldExchangeSchema = new Schema<IOldGoldExchange>(
  {
    exchangeId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },
    exchangeDate: { type: Date, required: true },
    oldGoldSubmitted: {
      weight: { type: Number, required: true },
      purity: { type: String, required: true },
      condition: { type: String, required: true },
      description: { type: String, required: true },
    },
    evaluatedValue: { type: Number, required: true },
    newGoldPurchased: {
      itemId: { type: String, required: true },
      itemName: { type: String, required: true },
      weight: { type: Number, required: true },
      cost: { type: Number, required: true },
    },
    amountPaid: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, default: "completed" },
  },
  { timestamps: true }
);

export default model<IOldGoldExchange>("OldGoldExchange", oldGoldExchangeSchema);
