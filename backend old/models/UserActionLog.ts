import mongoose from "mongoose";

const UserActionLogSchema = new mongoose.Schema({
  targetUserId: { type: String, required: true, index: true },
  targetUserEmail: { type: String, required: true },
  adminId: { type: String, required: true },
  adminEmail: { type: String, required: true },
  action: { type: String, required: true, enum: ["BLOCK", "ACTIVATE", "DEACTIVATE", "FORCE_PASSWORD_RESET", "LOGOUT_ALL_SESSIONS"] },
  reason: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now }
});

const UserActionLog = (mongoose.models.UserActionLog || mongoose.model("UserActionLog", UserActionLogSchema)) as mongoose.Model<any>;

export default UserActionLog;
