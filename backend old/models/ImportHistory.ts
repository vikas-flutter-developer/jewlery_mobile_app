import mongoose from "mongoose";

const importHistorySchema = new mongoose.Schema(
  {
    importId: { type: String, required: true, unique: true, index: true },
    uploadedBy: { type: String, required: true },
    uploadedByEmail: { type: String },
    uploadDate: { type: Date, default: Date.now, index: true },
    fileName: { type: String, required: true },
    originalFileName: { type: String, required: true },
    importedRecords: { type: Number, default: 0 },
    skippedRecords: { type: Number, default: 0 },
    failedRecords: { type: Number, default: 0 },
    totalRows: { type: Number, default: 0 },
    processingTimeMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "PARTIAL", "FAILED"],
      default: "PENDING",
      index: true,
    },
    errorReportPath: { type: String },
    errorReportUrl: { type: String },
    summary: { type: String },
  },
  { timestamps: true }
);

importHistorySchema.index({ uploadedBy: 1, uploadDate: -1 });

const ImportHistory =
  (mongoose.models.ImportHistory ||
    mongoose.model("ImportHistory", importHistorySchema)) as mongoose.Model<any>;
export default ImportHistory;
