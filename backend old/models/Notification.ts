import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: String, default: "default-shop" },
    storeId: { type: String, default: "default-shop" },
    type: { type: String, required: true, default: "GENERAL" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    category: { type: String, default: "General" },
    severity: { type: String, enum: ["INFO", "WARNING", "CRITICAL"], default: "INFO" },
    channels: {
      type: [{ type: String, enum: ["EMAIL", "WHATSAPP", "IN_APP"] }],
      default: ["IN_APP"],
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "SIMULATED"],
      default: "PENDING",
    },
    recipientEmails: { type: [String], default: [] },
    recipientPhones: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    reference: { type: String },
    relatedEntityId: { type: String },
    sendAt: { type: Date, default: () => new Date() },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default NotificationSchema;
