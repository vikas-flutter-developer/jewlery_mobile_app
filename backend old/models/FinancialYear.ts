import mongoose from "mongoose";

const financialYearSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true }, // e.g. "2026-27"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "CLOSED", "UPCOMING"],
      default: "UPCOMING",
      index: true,
    },
    isDefault: { type: Boolean, default: false, index: true },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: "" },
    remarks: { type: String, default: "" }
  },
  {
    timestamps: true,
  }
);

const FinancialYear = (
  mongoose.models.FinancialYear ||
  mongoose.model("FinancialYear", financialYearSchema)
) as mongoose.Model<any>;

export default FinancialYear;
