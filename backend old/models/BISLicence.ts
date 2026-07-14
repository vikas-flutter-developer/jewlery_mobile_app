import mongoose from "mongoose";

const bisLicenceSchema = new mongoose.Schema(
  {
    licenceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    licenceHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    issuingAuthority: {
      type: String,
      required: true,
      trim: true,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    branchId: {
      type: String,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
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

// Compound index to prevent duplicate Licence numbers per tenant
bisLicenceSchema.index({ tenantId: 1, licenceNumber: 1 }, { unique: true });

const BISLicence =
  mongoose.models.BISLicence ||
  mongoose.model("BISLicence", bisLicenceSchema);

export default BISLicence;
