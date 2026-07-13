import { Schema, model } from "mongoose";

interface IAdvanceInventory {
  advanceId: string;
  itemId: string;
  itemName: string;
  quantityReserved: number;
  quantityAvailable: number;
  reservedFor: string;
  reservationDate: Date;
  expiryDate: Date;
  status: string;
  notes: string;
}

const advanceInventorySchema = new Schema<IAdvanceInventory>(
  {
    advanceId: { type: String, required: true, unique: true },
    itemId: { type: String, required: true },
    itemName: { type: String, required: true },
    quantityReserved: { type: Number, required: true },
    quantityAvailable: { type: Number, required: true },
    reservedFor: { type: String, required: true },
    reservationDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: { type: String, default: "reserved" },
    notes: { type: String },
  },
  { timestamps: true }
);

export default model<IAdvanceInventory>("AdvanceInventory", advanceInventorySchema);
