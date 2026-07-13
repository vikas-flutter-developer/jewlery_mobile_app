import mongoose from "mongoose";

const accountingEntrySchema = new mongoose.Schema({
  journalId: { type: String, required: true, index: true },
  account: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  description: String,
  reference: String,
  createdAt: { type: Date, default: Date.now }
});

const AccountingEntry = (mongoose.models.AccountingEntry || mongoose.model("AccountingEntry", accountingEntrySchema)) as mongoose.Model<any>;
export default AccountingEntry;
