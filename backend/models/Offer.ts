import { Schema, model } from "mongoose";

interface IOffer {
  offerId: string;
  offerName: string;
  description: string;
  offerType: string;
  discountPercentage?: number;
  discountValue?: number;
  applicableOn: string[];
  startDate?: Date;
  endDate?: Date;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  status: string;

  // Frontend compatibility fields
  code?: string;
  name?: string;
  validFrom?: Date;
  validTo?: Date;
  discountPercent?: number;
}

const offerSchema = new Schema<IOffer>(
  {
    offerId: { type: String, required: true, unique: true },
    offerName: { type: String, required: true },
    description: { type: String, required: true },
    offerType: { type: String, required: true },
    discountPercentage: { type: Number },
    discountValue: { type: Number },
    applicableOn: [{ type: String }],
    startDate: { type: Date },
    endDate: { type: Date },
    minPurchaseAmount: { type: Number },
    maxDiscountAmount: { type: Number },
    status: { type: String, default: "active" },

    // Frontend compatibility fields
    code: { type: String },
    name: { type: String },
    validFrom: { type: Date },
    validTo: { type: Date },
    discountPercent: { type: Number },
  },
  { timestamps: true }
);

export default model<IOffer>("Offer", offerSchema);
