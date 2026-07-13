import mongoose from "mongoose";

const RepairJobSchema = new mongoose.Schema({
  repairJobId: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true, index: true },
  itemDescription: { type: String, required: true },
  estimatedWeight: { type: Number, default: 0 },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  repairCost: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ["Received", "Assigned", "In Repair", "Ready", "Delivered"], 
    default: "Received" 
  },
  karikarId: { type: String }, // Links to karikar ID
  notes: { type: String },
  tenantId: { type: String, default: "default-shop", index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const RepairJob = (mongoose.models.RepairJob || mongoose.model("RepairJob", RepairJobSchema)) as mongoose.Model<any>;
export default RepairJob;
