import { Schema, model } from "mongoose";

interface IScheme {
  schemeId: string;
  schemeName: string;
  description: string;
  startDate: Date;
  endDate: Date;
  discountType: string;
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number;
  applicableOn: string[];
  status: string;
}

const schemeSchema = new Schema<IScheme>(
  {
    schemeId: { type: String, required: true, unique: true },
    schemeName: { type: String, required: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    discountType: { type: String, required: true },
    discountValue: { type: Number, required: true },
    minPurchaseAmount: { type: Number, required: true },
    maxDiscountAmount: { type: Number, required: true },
    applicableOn: [{ type: String }],
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

export default model<IScheme>("Scheme", schemeSchema);
