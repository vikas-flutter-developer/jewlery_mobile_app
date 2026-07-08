import mongoose from "mongoose";

const portalCheckoutSchema = new mongoose.Schema({
  checkoutId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  items: [{
    productId: String,
    name: String,
    weight: Number,
    purity: String,
    price: Number,
    total: Number
  }],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  giftWrap: { type: Boolean, default: false },
  insurance: { type: Boolean, default: false },
  tax: { type: Number, required: true },
  payable: { type: Number, required: true },
  status: { type: String, enum: ["PENDING_PAYMENT", "PAID_ONLINE", "PAID_COUNTER"], default: "PENDING_PAYMENT" },
  paymentMethod: { type: String, default: "Counter Cash" },
  transactionId: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const PortalCheckout = mongoose.models.PortalCheckout || mongoose.model("PortalCheckout", portalCheckoutSchema);
export default PortalCheckout;
