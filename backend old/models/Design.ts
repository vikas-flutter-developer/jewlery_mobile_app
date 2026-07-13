import mongoose from "mongoose";

const designSchema = new mongoose.Schema(
  {
    designCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    metalType: { type: String, required: true },
    standardPurity: { type: String, required: true },
    image: String,
    minStockThreshold: { type: Number, default: 2 },
    description: String,
    hasDiamonds: { type: Boolean, default: false },
    diamondCut: String,
    diamondClarity: String,
    diamondColor: String,
    diamondCarat: Number,
    units: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Design = (mongoose.models.Design || mongoose.model("Design", designSchema)) as mongoose.Model<any>;
export default Design;
