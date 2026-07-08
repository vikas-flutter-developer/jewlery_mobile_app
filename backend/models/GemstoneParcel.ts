import mongoose from "mongoose";

const gemstoneParcelSchema = new mongoose.Schema(
  {
    parcelNumber: { type: String, required: true, unique: true, index: true },
    gemstoneType: { type: String, required: true },
    weight: { type: Number, required: true },
    quantity: { type: Number, required: true },
    availableWeight: { type: Number, required: true },
    availableQuantity: { type: Number, required: true },
    rate: { type: Number, required: true },
    totalValue: { type: Number, required: true },
    clarity: String,
    color: String,
    shape: String,
    size: String,
    status: { type: String, default: "In Stock", enum: ["In Stock", "Partially Issued", "Fully Issued"] },
    description: String,
    history: [
      {
        issuedTo: { type: String, required: true },
        orderId: String,
        quantity: { type: Number, required: true },
        weight: { type: Number, required: true },
        notes: String,
        issuedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const GemstoneParcel = (mongoose.models.GemstoneParcel || mongoose.model("GemstoneParcel", gemstoneParcelSchema)) as mongoose.Model<any>;
export default GemstoneParcel;
