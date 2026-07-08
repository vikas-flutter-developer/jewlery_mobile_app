import mongoose from "mongoose";

const catalogueAuditLogSchema = new mongoose.Schema(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    action: {
      type: String,
      required: true,
      enum: [
        "PHOTO_UPLOAD",
        "PHOTO_DELETE",
        "PHOTO_SET_PRIMARY",
        "BULK_IMPORT",
        "BARCODE_PRINT",
        "BARCODE_PREVIEW",
      ],
      index: true,
    },
    entityType: { type: String, default: "INVENTORY" },
    entityId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String },
    userRole: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

catalogueAuditLogSchema.index({ userId: 1, createdAt: -1 });

const CatalogueAuditLog =
  (mongoose.models.CatalogueAuditLog ||
    mongoose.model("CatalogueAuditLog", catalogueAuditLogSchema)) as mongoose.Model<any>;
export default CatalogueAuditLog;
