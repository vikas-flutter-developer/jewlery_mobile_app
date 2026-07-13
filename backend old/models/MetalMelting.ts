import mongoose from "mongoose";

const metalMeltingSchema = new mongoose.Schema(
  {
    metalType: { type: String, required: true, trim: true, index: true },
    purity: { type: String, required: true, trim: true, index: true },
    inputWeight: { type: Number, required: true, min: 0 },
    outputWeight: { type: Number, required: true, min: 0 },
    lossWeight: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    branchId: { type: String, trim: true, index: true },
    createdBy: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

const MetalMelting =
  (mongoose.models.MetalMelting || mongoose.model("MetalMelting", metalMeltingSchema)) as mongoose.Model<any>;

export default MetalMelting;
