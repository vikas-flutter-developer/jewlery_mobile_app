import mongoose from "mongoose";
import { inventoryPhotoSchema } from "./inventoryPhotoSchema.js";

const inventorySchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, index: true },
    grossWeight: { type: Number, required: true },
    netWeight: { type: Number, required: true },
    purity: { type: String, required: true },
    fineWeight: { type: Number, required: true },
    diamondWeight: { type: Number, required: true },
    huid: { type: String, required: true },
    image: String,
    branchId: { type: String, required: true, index: true },
    barcode: { type: String, required: true, unique: true, index: true },
    tag: { type: String, required: true, unique: true, index: true },
    createdAt: { type: Date, default: Date.now },
    name: String,
    weight: Number,
    type: String,
    status: { type: String, default: "In Stock", enum: ["In Stock", "reserved", "sold"] },
    stock: { type: Number, default: 1 },
    price: Number,
    designCode: { type: String, index: true },
    showcase: { type: String, default: "HQ Vault" },
    tray: { type: String, default: "Main Tray" },
    inwardDate: { type: Date, default: Date.now },
    hallmarkCertificate: String,
    gemstoneCertificate: String,
    gemstoneCertificateType: { type: String, enum: ["GIA", "IGI", "HRD", "GRS", "OTHER", "N/A"], default: "N/A" },
    condition: { type: String, enum: ["New", "Display", "Repaired", "Damaged", "Consignment"], default: "New" },
    isConsignment: { type: Boolean, default: false },
    vendorId: { type: String },
    consignmentCommission: { type: Number, default: 0 },
    diamondCarat: { type: Number },
    diamondCut: { type: String, enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"] },
    diamondColor: { type: String, enum: ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "Fancy"] },
    diamondClarity: { type: String, enum: ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"] },
    diamondType: { type: String, enum: ["Natural", "Lab-Grown", "Fancy Color", "Simulant"] },
    category: { type: String, index: true },
    subCategory: { type: String, index: true },
    metal: { type: String, index: true },
    stoneWeight: { type: Number, default: 0 },
    makingCharges: { type: Number, default: 0 },
    stoneCharges: { type: Number, default: 0 },
    purchaseRate: { type: Number },
    sellingRate: { type: Number },
    location: { type: String },
    rfid: { type: String, sparse: true, index: true },
    hallmarkNumber: { type: String, index: true },
    description: { type: String },
    photos: { type: [inventoryPhotoSchema], default: [] },
    thumbnail: { type: String },
    primaryPhoto: { type: String },
    photoCount: { type: Number, default: 0 },
    lastPhotoUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

inventorySchema.index({ name: "text", sku: "text", barcode: "text", hallmarkNumber: "text" });
inventorySchema.index({ vendorId: 1, branchId: 1 });
inventorySchema.index({ rfid: 1 }, { unique: true, sparse: true });

const Inventory = (mongoose.models.Inventory || mongoose.model("Inventory", inventorySchema)) as mongoose.Model<any>;
export default Inventory;
