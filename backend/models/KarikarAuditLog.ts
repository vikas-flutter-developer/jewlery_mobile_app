import mongoose from 'mongoose';

const KarikarAuditLogSchema = new mongoose.Schema({
  karikarId: { type: String, required: true, index: true },
  actor: { type: String, default: 'karikar' },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

const KarikarAuditLog = (mongoose.models.KarikarAuditLog || mongoose.model('KarikarAuditLog', KarikarAuditLogSchema)) as mongoose.Model<any>;

export default KarikarAuditLog;
