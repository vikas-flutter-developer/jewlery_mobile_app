import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  ManufacturerPurchaseOrder,
  ManufacturerSchemeDefinition,
  ManufacturerSchemeEnrollment
} from "../manufacturer/models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
const currentDir = process.cwd();
const isBackendCwd = fs.existsSync(path.resolve(currentDir, ".env.local")) || fs.existsSync(path.resolve(currentDir, ".env"));
const backendRoot = isBackendCwd ? currentDir : path.resolve(currentDir, "backend");
dotenv.config({ path: path.resolve(backendRoot, ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI || "";

async function seedData() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not defined in environment variables!");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully!");

  // 1. Seed Purchase Orders
  console.log("Cleaning and seeding Purchase Orders...");
  await ManufacturerPurchaseOrder.deleteMany({});
  
  const purchaseOrders = [
    {
      poNumber: "PO-2026-0001",
      supplier: "Rajesh Exports",
      item: "22K Raw Gold Grain",
      unit: 1,
      metal: "Gold",
      purity: "22K",
      weight: 150.5,
      rate: 7100,
      makingCharges: 0,
      gstPercent: 3,
      total: 150.5 * 7100 * 1.03,
      status: "PENDING",
      receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      notes: "Awaiting purity inspection."
    },
    {
      poNumber: "PO-2026-0002",
      supplier: "MMTC PAMP",
      item: "24K Gold Bar 999",
      unit: 1,
      metal: "Gold",
      purity: "24K",
      weight: 500,
      rate: 7500,
      makingCharges: 1500,
      gstPercent: 3,
      total: (500 * 7500 + 1500) * 1.03,
      status: "RECEIVED",
      receivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      notes: "Secure vault storage transfer."
    },
    {
      poNumber: "PO-2026-0003",
      supplier: "Choksi Hera",
      item: "Fine Silver Granules",
      unit: 1,
      metal: "Silver",
      purity: "Other",
      weight: 1200,
      rate: 95,
      makingCharges: 500,
      gstPercent: 3,
      total: (1200 * 95 + 500) * 1.03,
      status: "PENDING",
      receivedAt: new Date(),
      notes: "Scheduled delivery Tuesday."
    },
    {
      poNumber: "PO-2026-0004",
      supplier: "Sovereign Metals",
      item: "Platinum Wire 950",
      unit: 1,
      metal: "Platinum",
      purity: "Other",
      weight: 80,
      rate: 3200,
      makingCharges: 4000,
      gstPercent: 3,
      total: (80 * 3200 + 4000) * 1.03,
      status: "RECEIVED",
      receivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      notes: "Used for high-end custom mounts."
    },
    {
      poNumber: "PO-2026-0005",
      supplier: "Vikas Refinery",
      item: "18K Gold Scrap",
      unit: 1,
      metal: "Gold",
      purity: "18K",
      weight: 320,
      rate: 5800,
      makingCharges: 0,
      gstPercent: 3,
      total: 320 * 5800 * 1.03,
      status: "INSPECT",
      receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      notes: "Pending fire assay report."
    }
  ];

  await ManufacturerPurchaseOrder.insertMany(purchaseOrders);
  console.log("✅ Seeded 5 Purchase Orders");

  // 2. Seed Scheme Definitions
  console.log("Cleaning and seeding Scheme Definitions...");
  await ManufacturerSchemeDefinition.deleteMany({});

  const schemeDefinitions = [
    {
      name: "Aura Gold Kitty Plan",
      type: "GOLD_SAVING",
      monthlyAmount: 2000,
      totalInstallments: 11,
      bonusAmount: 2000,
      goldWeightBased: false,
      description: "Pay 11 installments, get 1 installment free as bonus.",
      status: "ACTIVE"
    },
    {
      name: "Artisan Gold Weight Accumulator",
      type: "GOLD_SAVING",
      monthlyAmount: 5000,
      totalInstallments: 12,
      bonusAmount: 3000,
      goldWeightBased: true,
      description: "Monthly cash installments converted to equivalent gold weight based on market price.",
      status: "ACTIVE"
    },
    {
      name: "Silver Milestone Saver",
      type: "GOLD_SAVING",
      monthlyAmount: 1000,
      totalInstallments: 10,
      bonusAmount: 1000,
      goldWeightBased: false,
      description: "Save for wedding seasons and redeem with special making charge discounts.",
      status: "ACTIVE"
    },
    {
      name: "Bridal Suite Planner",
      type: "GOLD_SAVING",
      monthlyAmount: 10000,
      totalInstallments: 12,
      bonusAmount: 12000,
      goldWeightBased: false,
      description: "Premium bridal saving plan with guaranteed high-value return.",
      status: "ACTIVE"
    },
    {
      name: "Festive Gold Saver",
      type: "GOLD_SAVING",
      monthlyAmount: 3000,
      totalInstallments: 11,
      bonusAmount: 3000,
      goldWeightBased: false,
      description: "Dhanteras and Diwali festive special accumulator.",
      status: "ACTIVE"
    }
  ];

  const seededDefs = await ManufacturerSchemeDefinition.insertMany(schemeDefinitions);
  console.log("✅ Seeded 5 Scheme Definitions");

  // 3. Seed Scheme Enrollments (Defaulters & Matured Plans)
  console.log("Cleaning and seeding Scheme Enrollments...");
  await ManufacturerSchemeEnrollment.deleteMany({});

  const enrollments = [
    // ──── DEFAULTERS (status: ACTIVE, nextDueDate in the past) ────
    {
      enrollmentId: "ENR-DEFAULTER-001",
      customerId: "cust-1",
      customerName: "Rahul Sharma",
      customerPhone: "+91 98765 43210",
      schemeId: seededDefs[0]._id,
      schemeName: seededDefs[0].name,
      schemeType: seededDefs[0].type,
      monthlyAmount: seededDefs[0].monthlyAmount,
      totalInstallments: seededDefs[0].totalInstallments,
      completedInstallments: 2,
      paidAmount: 4000,
      goldAccumulated: 0.54,
      status: "ACTIVE",
      nextDueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      maturityDate: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000),
      installments: [
        { installmentId: "INST-1-A", amount: 2000, dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-2-A", amount: 2000, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-3-A", amount: 2000, dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), status: "PENDING" }
      ]
    },
    {
      enrollmentId: "ENR-DEFAULTER-002",
      customerId: "cust-2",
      customerName: "Priya Patel",
      customerPhone: "+91 87654 32109",
      schemeId: seededDefs[2]._id,
      schemeName: seededDefs[2].name,
      schemeType: seededDefs[2].type,
      monthlyAmount: seededDefs[2].monthlyAmount,
      totalInstallments: seededDefs[2].totalInstallments,
      completedInstallments: 1,
      paidAmount: 1000,
      goldAccumulated: 0,
      status: "ACTIVE",
      nextDueDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      maturityDate: new Date(Date.now() + 250 * 24 * 60 * 60 * 1000),
      installments: [
        { installmentId: "INST-1-B", amount: 1000, dueDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-2-B", amount: 1000, dueDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), status: "PENDING" }
      ]
    },
    {
      enrollmentId: "ENR-DEFAULTER-003",
      customerId: "cust-3",
      customerName: "Amit Verma",
      customerPhone: "+91 76543 21098",
      schemeId: seededDefs[1]._id,
      schemeName: seededDefs[1].name,
      schemeType: seededDefs[1].type,
      monthlyAmount: seededDefs[1].monthlyAmount,
      totalInstallments: seededDefs[1].totalInstallments,
      completedInstallments: 3,
      paidAmount: 15000,
      goldAccumulated: 2.12,
      status: "ACTIVE",
      nextDueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      maturityDate: new Date(Date.now() + 240 * 24 * 60 * 60 * 1000),
      installments: [
        { installmentId: "INST-1-C", amount: 5000, dueDate: new Date(Date.now() - 105 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-2-C", amount: 5000, dueDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-3-C", amount: 5000, dueDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-4-C", amount: 5000, dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), status: "PENDING" }
      ]
    },
    {
      enrollmentId: "ENR-DEFAULTER-004",
      customerId: "cust-4",
      customerName: "Sneha Reddy",
      customerPhone: "+91 65432 10987",
      schemeId: seededDefs[3]._id,
      schemeName: seededDefs[3].name,
      schemeType: seededDefs[3].type,
      monthlyAmount: seededDefs[3].monthlyAmount,
      totalInstallments: seededDefs[3].totalInstallments,
      completedInstallments: 0,
      paidAmount: 0,
      goldAccumulated: 0,
      status: "ACTIVE",
      nextDueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      maturityDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
      installments: [
        { installmentId: "INST-1-D", amount: 10000, dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), status: "PENDING" }
      ]
    },
    {
      enrollmentId: "ENR-DEFAULTER-005",
      customerId: "cust-5",
      customerName: "Vikram Singh",
      customerPhone: "+91 54321 09876",
      schemeId: seededDefs[4]._id,
      schemeName: seededDefs[4].name,
      schemeType: seededDefs[4].type,
      monthlyAmount: seededDefs[4].monthlyAmount,
      totalInstallments: seededDefs[4].totalInstallments,
      completedInstallments: 4,
      paidAmount: 12000,
      goldAccumulated: 1.68,
      status: "ACTIVE",
      nextDueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      maturityDate: new Date(Date.now() + 210 * 24 * 60 * 60 * 1000),
      installments: [
        { installmentId: "INST-1-E", amount: 3000, dueDate: new Date(Date.now() - 155 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-2-E", amount: 3000, dueDate: new Date(Date.now() - 125 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-3-E", amount: 3000, dueDate: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-4-E", amount: 3000, dueDate: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000), status: "PAID", paidAt: new Date() },
        { installmentId: "INST-5-E", amount: 3000, dueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), status: "PENDING" }
      ]
    },

    // ──── MATURED PLANS (status: MATURED) ────
    {
      enrollmentId: "ENR-MATURED-001",
      customerId: "cust-6",
      customerName: "Deepak Mehta",
      customerPhone: "+91 99887 76655",
      schemeId: seededDefs[0]._id,
      schemeName: seededDefs[0].name,
      schemeType: seededDefs[0].type,
      monthlyAmount: seededDefs[0].monthlyAmount,
      totalInstallments: seededDefs[0].totalInstallments,
      completedInstallments: 11,
      paidAmount: 22000,
      goldAccumulated: 3.12,
      status: "MATURED",
      maturityDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      maturedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      installments: []
    },
    {
      enrollmentId: "ENR-MATURED-002",
      customerId: "cust-7",
      customerName: "Anjali Gupta",
      customerPhone: "+91 88776 65544",
      schemeId: seededDefs[2]._id,
      schemeName: seededDefs[2].name,
      schemeType: seededDefs[2].type,
      monthlyAmount: seededDefs[2].monthlyAmount,
      totalInstallments: seededDefs[2].totalInstallments,
      completedInstallments: 10,
      paidAmount: 10000,
      goldAccumulated: 0,
      status: "MATURED",
      maturityDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      maturedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      installments: []
    },
    {
      enrollmentId: "ENR-MATURED-003",
      customerId: "cust-8",
      customerName: "Sunita Joshi",
      customerPhone: "+91 77665 54433",
      schemeId: seededDefs[4]._id,
      schemeName: seededDefs[4].name,
      schemeType: seededDefs[4].type,
      monthlyAmount: seededDefs[4].monthlyAmount,
      totalInstallments: seededDefs[4].totalInstallments,
      completedInstallments: 11,
      paidAmount: 33000,
      goldAccumulated: 4.62,
      status: "MATURED",
      maturityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      maturedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      installments: []
    },
    {
      enrollmentId: "ENR-MATURED-004",
      customerId: "cust-9",
      customerName: "Karan Johar",
      customerPhone: "+91 66554 43322",
      schemeId: seededDefs[3]._id,
      schemeName: seededDefs[3].name,
      schemeType: seededDefs[3].type,
      monthlyAmount: seededDefs[3].monthlyAmount,
      totalInstallments: seededDefs[3].totalInstallments,
      completedInstallments: 12,
      paidAmount: 120000,
      goldAccumulated: 16.85,
      status: "MATURED",
      maturityDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      maturedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      installments: []
    },
    {
      enrollmentId: "ENR-MATURED-005",
      customerId: "cust-10",
      customerName: "Rohan Das",
      customerPhone: "+91 55443 32211",
      schemeId: seededDefs[1]._id,
      schemeName: seededDefs[1].name,
      schemeType: seededDefs[1].type,
      monthlyAmount: seededDefs[1].monthlyAmount,
      totalInstallments: seededDefs[1].totalInstallments,
      completedInstallments: 12,
      paidAmount: 60000,
      goldAccumulated: 8.52,
      status: "MATURED",
      maturityDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      maturedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      installments: []
    }
  ];

  await ManufacturerSchemeEnrollment.insertMany(enrollments);
  console.log("✅ Seeded 10 Scheme Enrollments (5 Defaulters, 5 Matured)");

  console.log("Data seeding finished successfully!");
  process.exit(0);
}

seedData().catch(err => {
  console.error("Seeding failed: ", err);
  process.exit(1);
});
