import mongoose from "mongoose";

const complianceRecordSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  category: { type: String, default: "GENERAL" },
  description: String,
  status: { type: String, default: "OPEN" },
  assignedTo: String,
  notes: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ComplianceRecord = (mongoose.models.ComplianceRecord || mongoose.model("ComplianceRecord", complianceRecordSchema)) as mongoose.Model<any>;
export default ComplianceRecord;
