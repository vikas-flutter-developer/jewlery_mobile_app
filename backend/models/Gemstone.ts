import { Schema, model } from "mongoose";

interface IGemstone {
  gemstoneId: string;
  gemName: string;
  color: string;
  carat: number;
  quality: string;
  certificateNumber: string;
  origin: string;
  price: number;
  quantity: number;
  status: string;
}

const gemstoneSchema = new Schema<IGemstone>(
  {
    gemstoneId: { type: String, required: true, unique: true },
    gemName: { type: String, required: true },
    color: { type: String, required: true },
    carat: { type: Number, required: true },
    quality: { type: String, required: true },
    certificateNumber: { type: String, required: true },
    origin: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 0 },
    status: { type: String, default: "in_stock" },
  },
  { timestamps: true }
);

export default model<IGemstone>("Gemstone", gemstoneSchema);
