import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  ManufacturerOffer,
} from "../manufacturer/models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Also import retailer models
import Form60Model from "../models/Form60.js";
import SaleModel from "../models/Sale.js";

// Load env variables
const currentDir = process.cwd();
dotenv.config({ path: path.resolve(currentDir, ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI || "";

async function seedOfferAndComplianceData() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not defined!");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected!");

  // ── 1. Seed Offers ────────────────────────────────────────────────────────
  console.log("Seeding Offers & Coupons...");
  await ManufacturerOffer.deleteMany({});

  const offers = [
    {
      offerId: "DIWALI50",
      offerName: "Diwali Gold Festival",
      code: "DIWALI50",
      name: "Diwali Gold Festival",
      description: "50% off making charges on all gold jewellery this Diwali season.",
      offerType: "discount",
      discountPercentage: 50,
      discountPercent: 50,
      discountType: "PERCENTAGE",
      value: 50,
      minPurchase: 25000,
      minPurchaseAmount: 25000,
      maxDiscountAmount: 10000,
      isActive: true,
      applicableOn: ["Gold"],
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      validFrom: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      offerId: "BRIDAL10",
      offerName: "Bridal Season Special",
      code: "BRIDAL10",
      name: "Bridal Season Special",
      description: "Flat 10% off on bridal jewellery sets above ₹1,00,000.",
      offerType: "discount",
      discountPercentage: 10,
      discountPercent: 10,
      discountType: "PERCENTAGE",
      value: 10,
      minPurchase: 100000,
      minPurchaseAmount: 100000,
      isActive: true,
      applicableOn: ["Gold", "Diamond"],
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      validFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      offerId: "SILVER500",
      offerName: "Silver Saver Deal",
      code: "SILVER500",
      name: "Silver Saver Deal",
      description: "₹500 flat cashback on any silver jewellery purchase.",
      offerType: "cashback",
      discountValue: 500,
      discountType: "FIXED",
      value: 500,
      minPurchase: 3000,
      minPurchaseAmount: 3000,
      isActive: true,
      applicableOn: ["Silver"],
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      validFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      offerId: "NEWCUST15",
      offerName: "New Customer Welcome",
      code: "NEWCUST15",
      name: "New Customer Welcome",
      description: "15% off on first purchase for new walk-in customers.",
      offerType: "discount",
      discountPercentage: 15,
      discountPercent: 15,
      discountType: "PERCENTAGE",
      value: 15,
      minPurchase: 5000,
      minPurchaseAmount: 5000,
      maxDiscountAmount: 7500,
      isActive: true,
      applicableOn: ["All"],
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: "active",
    },
    {
      offerId: "SCHEMERED20",
      offerName: "Scheme Redemption Bonus",
      code: "SCHEMERED20",
      name: "Scheme Redemption Bonus",
      description: "20% off making charges when redeeming a completed gold savings scheme.",
      offerType: "discount",
      discountPercentage: 20,
      discountPercent: 20,
      discountType: "PERCENTAGE",
      value: 20,
      minPurchase: 0,
      minPurchaseAmount: 0,
      isActive: false,
      applicableOn: ["Gold"],
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      validFrom: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: "expired",
    }
  ];

  await ManufacturerOffer.insertMany(offers);
  console.log("✅ Seeded 5 Offers & Coupons");

  // ── 2. Seed Form60 records ────────────────────────────────────────────────
  console.log("Seeding Form 60 Records...");
  await Form60Model.deleteMany({});

  const form60Records = [
    {
      customerName: "Rahul Hegde",
      customerPhone: "9845098450",
      customerAddress: "45, Lotus Boulevard, Bangalore, Karnataka",
      amount: 245000,
      transactionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      transactionId: "INV-2026-903",
      aadharNumber: "XXXXXXXX4321",
      reasonNoPan: "Income below taxable threshold limit",
      verifiedBy: "Compliance Officer",
      status: "VERIFIED"
    },
    {
      customerName: "Sonia Sharma",
      customerPhone: "9988776655",
      customerAddress: "B-12 Sunrise Society, Pune, Maharashtra",
      amount: 315000,
      transactionDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      transactionId: "INV-2026-882",
      aadharNumber: "XXXXXXXX5678",
      reasonNoPan: "Agricultural income only",
      verifiedBy: "Compliance Officer",
      status: "VERIFIED"
    },
    {
      customerName: "Priya Patel",
      customerPhone: "9876543210",
      customerAddress: "C-301 Greenfield Towers, Ahmedabad, Gujarat",
      amount: 210000,
      transactionDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      transactionId: "INV-2026-855",
      aadharNumber: "XXXXXXXX9012",
      reasonNoPan: "Income below taxable threshold limit",
      verifiedBy: "Store Admin",
      status: "VERIFIED"
    },
    {
      customerName: "Amit Verma",
      customerPhone: "9122334455",
      customerAddress: "D-45 Shanti Nagar, Jaipur, Rajasthan",
      amount: 450000,
      transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      transactionId: "INV-2026-940",
      aadharNumber: "XXXXXXXX3456",
      reasonNoPan: "Senior citizen with fixed deposits only",
      verifiedBy: "Compliance Officer",
      status: "PENDING"
    },
    {
      customerName: "Deepa Rao",
      customerPhone: "9344551122",
      customerAddress: "E-7 MG Road, Hyderabad, Telangana",
      amount: 280000,
      transactionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      transactionId: "INV-2026-920",
      aadharNumber: "XXXXXXXX7890",
      reasonNoPan: "Housewife with no taxable income",
      verifiedBy: "Store Admin",
      status: "VERIFIED"
    }
  ];

  await Form60Model.insertMany(form60Records);
  console.log("✅ Seeded 5 Form 60 Records");

  // ── 3. Seed Sales records ──────────────────────────────────────────────────
  console.log("Seeding Sales Records...");
  await SaleModel.deleteMany({});

  const salesRecords = [
    {
      orderId: "INV-2026-001",
      estimateId: "EST-901",
      customerId: "cust_1",
      customerName: "Anil Mehta",
      customerPhone: "9876543210",
      customerEmail: "anil@example.com",
      items: [
        { barcode: "MOCK1", name: "Gold Temple Necklace", weight: 50, purity: "22K", price: 280000, total: 280000, makingCharge: 12000 }
      ],
      subtotal: 280000,
      discount: 10000,
      tax: 8100,
      total: 278100,
      exchangeDiscount: 0,
      payable: 278100,
      paymentMethod: "Bank Transfer",
      payments: [{ method: "Bank Transfer", amount: 278100 }],
      status: "completed",
      branchCode: "MAIN",
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    },
    {
      orderId: "INV-2026-002",
      estimateId: "EST-902",
      customerId: "cust_2",
      customerName: "Priyanka Sen",
      customerPhone: "9811223344",
      items: [
        { barcode: "MOCK2", name: "Victorian Silver Coins", weight: 80, purity: "Fine", price: 60000, total: 60000, makingCharge: 2000 }
      ],
      subtotal: 60000,
      discount: 2000,
      tax: 1740,
      total: 59740,
      exchangeDiscount: 0,
      payable: 59740,
      paymentMethod: "UPI",
      payments: [{ method: "UPI", amount: 59740 }],
      status: "completed",
      branchCode: "DELHI",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    },
    {
      orderId: "INV-2026-003",
      estimateId: "EST-903",
      customerId: "cust_3",
      customerName: "Rahul Hegde",
      customerPhone: "9845098450",
      items: [
        { barcode: "BAR001", name: "Solitaire Diamond Ring", weight: 8, purity: "18K", price: 150000, total: 150000, makingCharge: 8000 }
      ],
      subtotal: 150000,
      discount: 5000,
      tax: 4350,
      total: 149350,
      exchangeDiscount: 0,
      payable: 149350,
      paymentMethod: "Credit Card",
      payments: [{ method: "Credit Card", amount: 149350 }],
      status: "completed",
      branchCode: "BLR",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      orderId: "INV-2026-004",
      estimateId: "EST-904",
      customerId: "cust_1",
      customerName: "Anil Mehta",
      customerPhone: "9876543210",
      items: [
        { barcode: "HUID1", name: "Gold Kada Bangles", weight: 30, purity: "22K", price: 168000, total: 168000, makingCharge: 6000 }
      ],
      subtotal: 168000,
      discount: 8000,
      tax: 4800,
      total: 164800,
      exchangeDiscount: 15000,
      payable: 149800,
      paymentMethod: "Mixed",
      payments: [
        { method: "Cash", amount: 49800 },
        { method: "UPI", amount: 100000 }
      ],
      status: "completed",
      branchCode: "MAIN",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      orderId: "INV-2026-005",
      estimateId: "EST-905",
      customerId: "cust_4",
      customerName: "Sonia Sharma",
      customerPhone: "9988776655",
      items: [
        { barcode: "BAR002", name: "Gold Floral Choker", weight: 15, purity: "22K", price: 84000, total: 84000, makingCharge: 4000 }
      ],
      subtotal: 84000,
      discount: 0,
      tax: 2520,
      total: 86520,
      exchangeDiscount: 0,
      payable: 86520,
      paymentMethod: "UPI",
      payments: [{ method: "UPI", amount: 86520 }],
      status: "completed",
      branchCode: "DELHI",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }
  ];

  await SaleModel.insertMany(salesRecords);
  console.log("✅ Seeded 5 Sales Records");

  console.log("\n🎉 All compliance & offers data seeded successfully!");
  process.exit(0);
}

seedOfferAndComplianceData().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
