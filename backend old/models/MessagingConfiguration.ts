import mongoose from "mongoose";

const messagingConfigurationSchema = new mongoose.Schema(
  {
    channelType: {
      type: String,
      enum: ["EMAIL", "SMS", "WHATSAPP"],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    configuration: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: String,
    },
    tenantId: {
      type: String,
      default: "default-shop",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure provider is unique per tenant & channel type
messagingConfigurationSchema.index({ tenantId: 1, channelType: 1, provider: 1 }, { unique: true });

const MessagingConfiguration =
  mongoose.models.MessagingConfiguration ||
  mongoose.model("MessagingConfiguration", messagingConfigurationSchema);

export default MessagingConfiguration;
