import { Schema, model } from "mongoose";

interface IBarcode {
  barcodeId: string;
  itemId: string;
  itemName: string;
  barcode: string;
  qrCode: string;
  weight: number;
  purity: string;
  price?: number;
  certificateNumber: string;
  createdAt: Date;
  status: string;
}

const barcodeSchema = new Schema<IBarcode>(
  {
    barcodeId: { type: String, required: true, unique: true },
    itemId: { type: String, required: true },
    itemName: { type: String, required: true },
    barcode: { type: String, required: true, unique: true },
    qrCode: { type: String, required: true },
    weight: { type: Number, required: true },
    purity: { type: String, required: true },
    price: { type: Number },
    certificateNumber: { type: String, required: true },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

export default model<IBarcode>("Barcode", barcodeSchema);
