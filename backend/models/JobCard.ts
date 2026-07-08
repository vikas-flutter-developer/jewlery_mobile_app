import mongoose from "mongoose";

const JobCardSchema = new mongoose.Schema(
  {
    // Core tracking
    jobId: { type: String, required: true, index: true },
    jobCardNumber: { type: String, index: true },
    version: { type: Number, required: true, default: 1 },
    generatedBy: { type: String },
    generatedAt: { type: Date, default: Date.now },

    // PDF storage
    pdfPath: { type: String },
    pdfUrl: { type: String },

    // QR & barcode
    qrData: { type: String },
    barcode: { type: String },

    // ----- Job Information -----
    jobNumber: { type: String },
    jobDate: { type: Date },
    dueDate: { type: Date },
    status: { type: String },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },

    // ----- Customer Information -----
    customerName: { type: String },
    customerCode: { type: String },
    customerMobile: { type: String },

    // ----- Product Information -----
    productName: { type: String },
    category: { type: String },
    designCode: { type: String },
    designDescription: { type: String },

    // ----- Karikar Information -----
    karikarId: { type: String },
    karikarName: { type: String },
    karikarCode: { type: String },
    karikarSpecialization: { type: String },

    // ----- Metal Details -----
    metalType: { type: String },
    purity: { type: String },
    issuedWeight: { type: Number, default: 0 },
    stoneWeight: { type: Number, default: 0 },
    diamondWeight: { type: Number, default: 0 },

    // ----- Production Details -----
    quantity: { type: Number, default: 1 },
    size: { type: String },
    customInstructions: { type: String },
    remarks: { type: String },

    // ----- Branding / Store -----
    companyLogo: { type: String },
    storeName: { type: String },
    storeAddress: { type: String },
    branchName: { type: String },
    branchCode: { type: String },
    footerNotes: { type: String },

    // ----- Usage tracking -----
    downloadCount: { type: Number, default: 0 },
    printCount: { type: Number, default: 0 },

    notes: { type: String },
    tenantId: { type: String, default: "default-shop", index: true },
  },
  { timestamps: true }
);

JobCardSchema.index({ jobId: 1, version: -1 });
JobCardSchema.index({ tenantId: 1, karikarId: 1 });
JobCardSchema.index({ jobCardNumber: 1 });

const JobCard = (mongoose.models.JobCard ||
  mongoose.model("JobCard", JobCardSchema)) as mongoose.Model<any>;
export default JobCard;
