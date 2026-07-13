import mongoose from "mongoose";

const designApprovalSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    designId: { type: String, required: true, index: true },
    customerId: { type: String, index: true },
    submittedBy: { type: String, required: true },
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"],
      default: "PENDING",
      index: true
    },
    approvalDate: { type: Date },
    rejectionReason: { type: String },
    changeRequest: { type: String },
    notes: { type: String },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

const DesignApproval = (mongoose.models.DesignApproval || mongoose.model("DesignApproval", designApprovalSchema)) as mongoose.Model<any>;
export default DesignApproval;
