import mongoose from "mongoose";

const paymentGatewayConfigurationSchema = new mongoose.Schema(
  {
    gatewayName: {
      type: String,
      required: true,
      trim: true,
    },
    gatewayType: {
      type: String,
      enum: ["RAZORPAY", "CASHFREE", "PHONEPE", "STRIPE"],
      required: true,
      index: true,
    },
    apiKey: {
      type: String,
      required: true,
      trim: true,
    },
    secretKey: {
      type: String,
      required: true,
      trim: true,
    },
    webhookSecret: {
      type: String,
      trim: true,
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
    testMode: {
      type: Boolean,
      default: true,
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

// Compound index to ensure uniqueness of gatewayType per tenant
paymentGatewayConfigurationSchema.index({ tenantId: 1, gatewayType: 1 }, { unique: true });

const PaymentGatewayConfiguration =
  mongoose.models.PaymentGatewayConfiguration ||
  mongoose.model("PaymentGatewayConfiguration", paymentGatewayConfigurationSchema);

export default PaymentGatewayConfiguration;
