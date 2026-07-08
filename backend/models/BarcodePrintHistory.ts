import mongoose from "mongoose";

const barcodePrintHistorySchema = new mongoose.Schema(
  {
    printJobId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
    printDate: { type: Date, default: Date.now, index: true },
    printerType: {
      type: String,
      enum: ["THERMAL_58MM", "THERMAL_80MM", "JEWELLERY_TAG", "A4_SHEET"],
      required: true,
    },
    numberOfTags: { type: Number, required: true },
    skuCount: { type: Number, required: true },
    generatedPdfPath: { type: String },
    generatedPdfUrl: { type: String },
    filterCriteria: { type: mongoose.Schema.Types.Mixed },
    skuIds: [{ type: String }],
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true }
);

barcodePrintHistorySchema.index({ userId: 1, printDate: -1 });

const BarcodePrintHistory =
  (mongoose.models.BarcodePrintHistory ||
    mongoose.model("BarcodePrintHistory", barcodePrintHistorySchema)) as mongoose.Model<any>;
export default BarcodePrintHistory;
