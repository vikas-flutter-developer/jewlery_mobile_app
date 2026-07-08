import mongoose from "mongoose";

const wholesaleOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  invoiceNumber: { type: String, required: true },
  customerName: { type: String, required: true },
  customerPhone: String,
  items: [
    {
      description: String,
      metal: String,
      purity: String,
      weight: Number,
      unitRate: Number,
      quantity: { type: Number, default: 1 },
      total: Number,
    }
  ],
  subtotal: Number,
  discount: Number,
  tax: Number,
  total: Number,
  deliveryDate: Date,
  status: { type: String, default: "CONFIRMED" },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const WholesaleOrder = (mongoose.models.WholesaleOrder || mongoose.model("WholesaleOrder", wholesaleOrderSchema)) as mongoose.Model<any>;
export default WholesaleOrder;
