import mongoose from "mongoose";

const rfidTagSchema = new mongoose.Schema(
  {
    epc: { type: String, required: true, unique: true, index: true },
    inventoryId: { type: String, required: true, index: true }, // Links to Inventory sku/barcode/tag
    status: { 
      type: String, 
      enum: ["Unassigned", "Assigned", "In Stock", "In Transit", "POS Scanned", "Sold", "Defective"], 
      default: "Assigned" 
    },
    auditHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        status: { type: String, required: true },
        userId: String,
        notes: String,
        branchId: String
      }
    ]
  },
  { timestamps: true }
);

const RFIDTag = (mongoose.models.RFIDTag || mongoose.model("RFIDTag", rfidTagSchema)) as mongoose.Model<any>;
export default RFIDTag;
