import mongoose from "mongoose";

/**
 * InvoiceProfile — shop / store details printed on every invoice.
 * Typically one document per tenant.
 */
const invoiceProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, index: true, unique: true },

    // Shop identity
    shopName: { type: String, default: "AuraJewel Store" },
    tagline: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: "India" },

    // Tax / compliance
    gstin: { type: String },          // 15-character GSTIN
    pan: { type: String },            // 10-character PAN
    bisLicence: { type: String },     // BIS hallmark licence e.g. CM/L-XXXXXXXXXX
    fssaiNumber: { type: String },    // Optional

    // Contact
    phone: { type: String },
    altPhone: { type: String },
    email: { type: String },
    website: { type: String },

    // Bank details (for payment QR / wire transfers)
    bankDetails: {
      accountName: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
      branch: String,
      upiId: String,
    },

    // Branding
    logo: { type: String },           // base64 or URL
    signatureImageUrl: { type: String },
    invoiceFooterNote: { type: String },

    // Terms & conditions
    termsAndConditions: { type: [String], default: [
      "All goods once sold cannot be returned or exchanged.",
      "Rates are subject to change without prior notice.",
      "BIS hallmarked jewellery only.",
      "This is a computer generated invoice.",
    ]},

    // GST settings
    isInterState: { type: Boolean, default: false }, // IGST vs CGST+SGST
    defaultGstRate: { type: Number, default: 3 },    // 3% for jewellery
  },
  { timestamps: true }
);

const InvoiceProfile = (mongoose.models.InvoiceProfile ||
  mongoose.model("InvoiceProfile", invoiceProfileSchema)) as mongoose.Model<any>;

export default InvoiceProfile;
