import mongoose from "mongoose";

const Form60Schema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true, index: true },
    customerAddress: { type: String, required: true },
    amount: { type: Number, required: true },
    transactionDate: { type: Date, default: Date.now },
    transactionId: { type: String, required: true, index: true }, // Links to POS sale ID/orderId
    aadharNumber: { type: String, required: true },
    reasonNoPan: { type: String, required: true }, // e.g. "Agricultural Income Only", "Income under Taxable Limits"
    digitalSignature: { type: String }, // Digital signature svg or data URL path
    aadharDocumentPath: { type: String }, // Uploaded Aadhaar image link
    verifiedBy: { type: String, default: "System Admin" },
    status: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "VERIFIED" }
  },
  { timestamps: true }
);

const Form60 = (mongoose.models.Form60 || mongoose.model("Form60", Form60Schema)) as mongoose.Model<any>;
export default Form60;
