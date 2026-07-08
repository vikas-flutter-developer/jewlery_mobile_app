import mongoose from "mongoose";

const bisCertificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, required: true, unique: true, index: true },
    inventoryId: { type: String, required: true, index: true },
    barcode: { type: String, index: true },
    certificateNumber: { type: String, required: true, index: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    uploadedFile: { type: String },
    originalFileName: { type: String },
    mimeType: { type: String },
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "REVOKED"], default: "ACTIVE" },
    notes: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bisCertificateSchema.index({ inventoryId: 1, status: 1 });
bisCertificateSchema.index({ expiryDate: 1 });

const BisCertificate =
  (mongoose.models.BisCertificate ||
    mongoose.model("BisCertificate", bisCertificateSchema)) as mongoose.Model<any>;

export default BisCertificate;
