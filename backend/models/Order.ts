import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  customerName: String,
  customerContact: String,
  items: [{
    category: String,
    weight: Number,
    description: String,
  }],
  status: { type: String, default: "PENDING" },
  deadline: Date,
  createdAt: { type: Date, default: Date.now },

  // Standard fields mapped from frontend OrderManagement form
  customer: String,
  customerPhone: String,
  customerEmail: String,
  customerAadhar: String,
  specifications: String,
  priority: { type: String, default: "Normal" },
  neededDate: String,
  metalType: { type: String, enum: ["GOLD", "SILVER", "PLATINUM"], default: "GOLD" },
  carat: { type: String, default: "" },
  customCarat: { type: String, default: "" },
  customDiamondDesign: { type: String, default: "" },
  diamondDetails: [{
    cut: String,
    clarity: String,
    colour: String,
    carat: Number,
    qty: { type: Number, default: 1 },
    type: { type: String, default: "Natural" }
  }],
  assignedKarikarId: String,
  assignedKarikarName: String,
  designCode: String,
  designName: String,
  customDescription: String,
  uploadedImages: [{
    url: String,
    name: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
  issuedGrams: Number,
  metalLossGrams: Number,
  gstRate: Number,
  sellingPrice: Number,
  estimatedMetalValue: Number,
  metalLossCost: Number,
  diamondValue: Number,
  labourCharges: Number,
  gstAmount: Number,
  totalPrice: Number,
  profitAmount: Number,
  profitMargin: Number,
  inventoryReference: String,
  assignedKarikarStatus: String,

  billingSummary: {
    issuedGrams: Number,
    metalLossGrams: Number,
    metalLossCost: Number,
    labourCharges: Number,
    diamondValue: Number,
    gstRate: Number,
    gstAmount: Number,
    estimatedMetalValue: Number,
    sellingPrice: Number,
    totalPrice: Number,
    profitAmount: Number,
    profitMargin: Number,
  },

  workloadSummary: {
    assignedKarikarId: String,
    assignedKarikarName: String,
    status: String,
    currentJobCount: Number,
    notes: String,
  },

  // Custom Order & Design (Features 192-196)
  isCustom: { type: Boolean, default: true },
  designMoodboard: [{ type: String }], // Array of uploaded moodboard image URLs
  cadDesigns: [{
    url: String,
    name: String,
    sharedAt: { type: Date, default: Date.now },
  }],
  designApproval: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  revisions: [{
    revisionNo: Number,
    notes: String,
    imageUrl: String,
    updatedAt: { type: Date, default: Date.now },
    costEstimate: {
      metalCost: Number,
      stoneCost: Number,
      makingCharges: Number,
      tax: Number,
      total: Number,
    }
  }],
  costEstimate: {
    metalCost: { type: Number, default: 0 },
    stoneCost: { type: Number, default: 0 },
    makingCharges: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  }
});

const Order = (mongoose.models.Order || mongoose.model("Order", orderSchema)) as mongoose.Model<any>;
export default Order;
