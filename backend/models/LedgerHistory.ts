import { Schema, model } from "mongoose";

export interface ILedgerHistory {
  transactionId: string;
  customerId: string;
  customerPhone: string;
  category: string; // 'SCHEME_EMI' | 'STORE_PURCHASE' | 'BESPOKE_BOOKING'
  title: string;
  description: string;
  amount: number;
  goldGrams: number;
  paymentMethod: string;
  status: string; // 'CLEARED' | 'PENDING'
  date: Date;
}

const ledgerHistorySchema = new Schema<ILedgerHistory>(
  {
    transactionId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    customerPhone: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    goldGrams: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "UPI" },
    status: { type: String, default: "CLEARED" },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default model<ILedgerHistory>("LedgerHistory", ledgerHistorySchema);
