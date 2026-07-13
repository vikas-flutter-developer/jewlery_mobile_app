import mongoose from "mongoose";

const SecurityAuditSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  details: { type: String },
  createdAt: { type: String, required: true }
});

export default SecurityAuditSchema;
