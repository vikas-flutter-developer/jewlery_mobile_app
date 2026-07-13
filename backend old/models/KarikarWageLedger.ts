import mongoose from "mongoose";

const karikarWageLedgerSchema = new mongoose.Schema(
  {
    wageLedgerId: { type: String, required: true, unique: true, index: true },
    karikarId: { type: String, required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    periodLabel: { type: String, default: "" },
    baseWage: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    advances: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "" },
    paymentReference: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "PARTIAL", "PAID", "REJECTED"],
      default: "PENDING",
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    requestNotes: { type: String },
    adminNotes: { type: String },
    requestedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

karikarWageLedgerSchema.index({ karikarId: 1, periodStart: -1, periodEnd: -1 });

const KarikarWageLedger =
  (mongoose.models.KarikarWageLedger ||
    mongoose.model("KarikarWageLedger", karikarWageLedgerSchema)) as mongoose.Model<any>;

export default KarikarWageLedger;
