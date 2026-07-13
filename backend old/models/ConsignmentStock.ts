import mongoose from "mongoose";

const ConsignmentStockSchema = new mongoose.Schema({
  consignmentCode: { type: String, required: true, unique: true, index: true },
  consignorName: { type: String, required: true, index: true },
  itemDescription: { type: String, required: true },
  metalType: { type: String, required: true },
  weight: { type: Number, required: true },
  purity: { type: String, required: true },
  price: { type: Number, required: true },
  commissionRate: { type: Number, default: 10 },
  status: { 
    type: String, 
    enum: ["AVAILABLE", "SOLD", "RETURNED"], 
    default: "AVAILABLE" 
  },
  soldDate: { type: Date },
  returnedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ConsignmentStock = (mongoose.models.ConsignmentStock || mongoose.model("ConsignmentStock", ConsignmentStockSchema)) as mongoose.Model<any>;
export default ConsignmentStock;
