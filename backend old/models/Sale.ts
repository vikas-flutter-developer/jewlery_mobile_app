import mongoose from "mongoose";

const saleSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  estimateId: String,
  customerId: String,
  customerName: { type: String, required: true },
  customerPhone: String,
  customerEmail: String,
  customerAadhar: String,
  items: [{
    barcode: String,
    name: String,
    weight: Number,
    purity: String,
    price: Number,
    total: Number,
    makingCharge: Number,
  }],
  subtotal: Number,
  discount: Number,
  tax: Number,
  total: Number,
  exchangeDiscount: Number,
  payable: Number,
  paymentMethod: String,
  payments: [{
    method: String,
    amount: Number,
    reference: String,
  }],
  financialStatus: {
    type: String,
    enum: ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"],
    default: "PAID",
  },
  amountPaid: { type: Number, default: 0 },
  amountOutstanding: { type: Number, default: 0 },
  allowOutstanding: { type: Boolean, default: false },
  status: { type: String, default: "completed" },
  branchCode: { type: String, default: "MAIN" },
  customerPan: String,
  tcs: Number,
  bisLicence: { type: String, default: "CM/L-8700148415" },
  staffId: String,
  staffName: String,
  taxProfileId: String,
  createdAt: { type: Date, default: Date.now },
});

const Sale = (mongoose.models.Sale || mongoose.model("Sale", saleSchema)) as mongoose.Model<any>;
export default Sale;
