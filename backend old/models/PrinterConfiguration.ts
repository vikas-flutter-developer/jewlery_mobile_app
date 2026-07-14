import mongoose from "mongoose";

const printerConfigurationSchema = new mongoose.Schema(
  {
    printerName: {
      type: String,
      required: true,
      trim: true,
    },
    printerType: {
      type: String,
      enum: ["THERMAL_58", "THERMAL_80", "A4", "BARCODE", "TAG"],
      required: true,
      index: true,
    },
    connectionType: {
      type: String,
      enum: ["USB", "NETWORK", "BLUETOOTH"],
      required: true,
      index: true,
    },
    printerIdentifier: {
      type: String,
      required: true,
      trim: true,
    },
    paperSize: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    branchId: {
      type: String,
      default: "default-branch",
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

// Compound index to ensure uniqueness of printerName per tenant and branch
printerConfigurationSchema.index({ tenantId: 1, branchId: 1, printerName: 1 }, { unique: true });

const PrinterConfiguration =
  mongoose.models.PrinterConfiguration ||
  mongoose.model("PrinterConfiguration", printerConfigurationSchema);

export default PrinterConfiguration;
