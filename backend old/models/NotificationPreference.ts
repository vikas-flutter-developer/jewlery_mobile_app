import mongoose from "mongoose";

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: ["STORE", "USER"],
      required: true,
      default: "STORE",
    },
    ownerId: { type: String, required: true },
    channels: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
    categories: { type: [String], default: [] },
    language: { type: String, default: "en" },
  },
  {
    timestamps: true,
  }
);

NotificationPreferenceSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export default NotificationPreferenceSchema;
