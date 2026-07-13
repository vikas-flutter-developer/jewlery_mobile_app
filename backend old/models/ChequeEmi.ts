import mongoose from "mongoose";

const ChequeEmiSchema = new mongoose.Schema({
  chequeNumber: { type: String, required: true, index: true },
  billId: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String },
  bank: { type: String, required: true },
  clearDate: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["PENDING", "CLEARED", "BOUNCED"], 
    default: "PENDING",
    index: true
  },
  bouncedReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ChequeEmi = (mongoose.models.ChequeEmi || mongoose.model("ChequeEmi", ChequeEmiSchema)) as mongoose.Model<any>;
export default ChequeEmi;
