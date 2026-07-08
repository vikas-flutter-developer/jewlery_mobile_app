import mongoose from "mongoose";

const retailerOrderSchema = new mongoose.Schema({
  retailerId: { type: String, required: true },
  retailerEmail: { type: String, required: true },
  itemType: { type: String, required: true }, // Ring, Necklace, Gold Biscuit, Gold Coin, etc.
  purity: { type: String, required: true }, // 24K, 22K, 18K, 14K
  weight: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 1 },
  diamondCarat: Number,
  diamondCut: String,
  diamondClarity: String,
  diamondColor: String,
  notes: String,
  status: { type: String, default: "Pending", enum: ["Pending", "Approved", "In Production", "Completed", "Dispatched", "Cancelled"] },
  karikarId: String,
  karikarName: String,
  manufacturerId: String,
  manufacturerName: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const RetailerOrder = (mongoose.models.RetailerOrder || mongoose.model("RetailerOrder", retailerOrderSchema)) as mongoose.Model<any>;
export default RetailerOrder;
