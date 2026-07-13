import mongoose from "mongoose";

const khataSchema = new mongoose.Schema({
  customerName: String,
  customerPhone: String,
  customerAadhar: String,
  transactions: [{
    type: { type: String, enum: ["CREDIT", "DEBIT"] },
    amount: Number,
    note: String,
    date: { type: Date, default: Date.now },
  }],
  balance: { type: Number, default: 0 },
});

const Khata = (mongoose.models.Khata || mongoose.model("Khata", khataSchema)) as mongoose.Model<any>;
export default Khata;
