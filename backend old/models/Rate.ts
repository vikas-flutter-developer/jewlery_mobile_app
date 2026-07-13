import mongoose from "mongoose";

const rateSchema = new mongoose.Schema({
  metal: { type: String, required: true },
  purity: { type: String, default: "24K" },
  rate: { type: Number, required: true },
  makingPercent: { type: Number, default: 0 },
  gstPercent: { type: Number, default: 0 },
  effectivePrice: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const Rate = (mongoose.models.Rate || mongoose.model("Rate", rateSchema)) as mongoose.Model<any>;
export default Rate;
