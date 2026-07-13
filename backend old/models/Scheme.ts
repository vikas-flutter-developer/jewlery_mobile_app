import mongoose from "mongoose";

const schemeDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["GOLD_SAVING", "CHIT_FUND"], default: "GOLD_SAVING" },
    monthlyAmount: { type: Number, required: true },
    totalInstallments: { type: Number, required: true },
    bonusAmount: { type: Number, default: 0 },
    goldWeightBased: { type: Boolean, default: false },
    description: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
  },
  { timestamps: true }
);

const installmentRecordSchema = new mongoose.Schema({
  installmentId: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidAt: { type: Date },
  status: { type: String, enum: ["PENDING", "PAID"], default: "PENDING" },
  paymentMethod: String,
  transactionId: String,
  goldGramsAccumulated: { type: Number, default: 0 },
  notes: String
});

const schemeEnrollmentSchema = new mongoose.Schema(
  {
    enrollmentId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true, index: true },
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: "SchemeDefinition" },
    schemeName: { type: String, required: true },
    schemeType: { type: String, required: true },
    monthlyAmount: { type: Number, required: true },
    totalInstallments: { type: Number, required: true },
    completedInstallments: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    goldAccumulated: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "MATURED", "REDEEMED", "LAPSED"], default: "ACTIVE" },
    installments: [installmentRecordSchema],
    nextDueDate: { type: Date },
    maturityDate: { type: Date },
    maturedDate: { type: Date },
    redeemedDate: { type: Date },
    redeemedInvoiceId: { type: String }
  },
  { timestamps: true }
);

export const SchemeDefinition = (mongoose.models.SchemeDefinition || mongoose.model("SchemeDefinition", schemeDefinitionSchema)) as mongoose.Model<any>;
export const SchemeEnrollment = (mongoose.models.SchemeEnrollment || mongoose.model("SchemeEnrollment", schemeEnrollmentSchema)) as mongoose.Model<any>;
