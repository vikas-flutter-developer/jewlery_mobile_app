import mongoose from "mongoose";

const CashDenominationSchema = new mongoose.Schema({
  closingDate: { type: String, required: true, index: true },
  denominations: {
    type: Map,
    of: Number,
    default: {}
  },
  totalAmount: { type: Number, required: true },
  calculatedClosingBalance: { type: Number, required: true },
  mismatchAmount: { type: Number, default: 0 },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const CashDenomination = (mongoose.models.CashDenomination || mongoose.model("CashDenomination", CashDenominationSchema)) as mongoose.Model<any>;
export default CashDenomination;
