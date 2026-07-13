import mongoose from "mongoose";

const designRevisionImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, default: "" },
  },
  { _id: false }
);

const designRevisionSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    designId: { type: String, required: true, index: true },
    revisionNumber: { type: Number, required: true, index: true },
    previousVersionId: { type: String, default: null },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, default: "" },
    createdByRole: { type: String, default: "" },
    revisionReason: { type: String, default: "" },
    changeSummary: { type: String, default: "" },
    images: { type: [designRevisionImageSchema], default: [] },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"],
      default: "DRAFT",
      index: true,
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

designRevisionSchema.index({ orderId: 1, designId: 1, revisionNumber: 1 }, { unique: true });

class DesignRevisionClass {}

designRevisionSchema.loadClass(DesignRevisionClass);

const DesignRevision = (mongoose.models.DesignRevision || mongoose.model("DesignRevision", designRevisionSchema)) as mongoose.Model<any>;
export default DesignRevision;
