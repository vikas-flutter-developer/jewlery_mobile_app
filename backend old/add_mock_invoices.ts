import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, ".env") });
}

async function addInvoices() {
  const uri = process.env.MONGODB_URI || "";
  console.log("Connecting to:", uri ? "MongoDB Atlas URI" : "Empty URI");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    // Invoices are stored in the 'retailer' database for tenant shop-1779518126045-txlhr
    const db = client.db("retailer");
    const collection = db.collection("invoices");

    // Clean existing mock invoices first
    await collection.deleteMany({ invoiceNumber: { $in: ["INV-2026-0001", "INV-2026-0002", "INV-2026-0003"] } });

    const mockInvoices = [
      {
        invoiceNumber: "INV-2026-0001",
        type: "GST",
        storeProfile: {
          shopName: "AuraJewel Premium Showroom",
          address: "123 Gold Mansion, Karol Bagh",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110005",
          gstin: "07AAAAA1111A1Z1", // Valid GSTIN format
          pan: "AAAAA1111A",
          phone: "9999988888",
          email: "delhi@aurajewel.com"
        },
        customerInfo: {
          name: "John Doe",
          phone: "9876543210",
          city: "Delhi",
          state: "Delhi",
          pan: "ABCDE1234F"
        },
        items: [
          {
            name: "Gold Ring 22K",
            hsnCode: "7113",
            grossWeight: 8.5,
            netWeight: 8.2,
            goldRate: 7200,
            goldAmount: 59040,
            makingCharge: 450,
            makingChargeType: "PER_GRAM",
            price: 62730,
            qty: 1,
            taxableValue: 62730,
            gstRate: 3,
            cgstRate: 1.5,
            sgstRate: 1.5,
            igstRate: 0,
            cgstAmount: 940.95,
            sgstAmount: 940.95,
            igstAmount: 0,
            itemTotal: 64611.9
          }
        ],
        subtotal: 62730,
        discount: 0,
        taxableAmount: 62730,
        gstBreakup: {
          cgstRate: 1.5,
          sgstRate: 1.5,
          igstRate: 0,
          cgstAmount: 940.95,
          sgstAmount: 940.95,
          igstAmount: 0,
          totalGst: 1881.9,
          taxableValue: 62730
        },
        grandTotal: 64612,
        status: "final",
        branchCode: "MAIN",
        tenantId: "shop-1779518126045-txlhr",
        financialYear: "FY2026-27",
        createdAt: new Date("2026-07-10T10:00:00Z"),
        updatedAt: new Date("2026-07-10T10:00:00Z")
      },
      {
        invoiceNumber: "INV-2026-0002",
        type: "GST",
        storeProfile: {
          shopName: "AuraJewel Premium Showroom",
          address: "123 Gold Mansion, Karol Bagh",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110005",
          gstin: "07AAAAA1111A1Z1",
          pan: "AAAAA1111A",
          phone: "9999988888",
          email: "delhi@aurajewel.com"
        },
        customerInfo: {
          name: "Jane Smith",
          phone: "9876543211",
          city: "Noida",
          state: "Uttar Pradesh",
          pan: "WXYZP9876Q"
        },
        items: [
          {
            name: "Diamond Necklace 18K",
            hsnCode: "7113",
            grossWeight: 24.2,
            netWeight: 22.0,
            goldRate: 6100,
            goldAmount: 134200,
            makingCharge: 15000,
            makingChargeType: "FLAT",
            stoneCharge: 45000,
            price: 194200,
            qty: 1,
            taxableValue: 194200,
            gstRate: 3,
            cgstRate: 1.5,
            sgstRate: 1.5,
            igstRate: 0,
            cgstAmount: 2913,
            sgstAmount: 2913,
            igstAmount: 0,
            itemTotal: 200026
          }
        ],
        subtotal: 194200,
        discount: 5000,
        taxableAmount: 189200,
        gstBreakup: {
          cgstRate: 1.5,
          sgstRate: 1.5,
          igstRate: 0,
          cgstAmount: 2838,
          sgstAmount: 2838,
          igstAmount: 0,
          totalGst: 5676,
          taxableValue: 189200
        },
        grandTotal: 194876,
        status: "final",
        branchCode: "MAIN",
        tenantId: "shop-1779518126045-txlhr",
        financialYear: "FY2026-27",
        createdAt: new Date("2026-07-12T14:30:00Z"),
        updatedAt: new Date("2026-07-12T14:30:00Z")
      },
      {
        invoiceNumber: "INV-2026-0003",
        type: "GST",
        storeProfile: {
          shopName: "AuraJewel Premium Showroom",
          address: "123 Gold Mansion, Karol Bagh",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110005",
          gstin: "07AAAAA1111A1Z1",
          pan: "AAAAA1111A",
          phone: "9999988888",
          email: "delhi@aurajewel.com"
        },
        customerInfo: {
          name: "Bob Johnson",
          phone: "9876543212",
          city: "Delhi",
          state: "Delhi",
          pan: "" // empty PAN will trigger exceptions testing too
        },
        items: [
          {
            name: "Silver Anklet",
            hsnCode: "7113",
            grossWeight: 45.0,
            netWeight: 45.0,
            goldRate: 90, // Silver rate per gram
            goldAmount: 4050,
            makingCharge: 500,
            makingChargeType: "FLAT",
            price: 4550,
            qty: 1,
            taxableValue: 4550,
            gstRate: 3,
            cgstRate: 1.5,
            sgstRate: 1.5,
            igstRate: 0,
            cgstAmount: 68.25,
            sgstAmount: 68.25,
            igstAmount: 0,
            itemTotal: 4686.5
          }
        ],
        subtotal: 4550,
        discount: 0,
        taxableAmount: 4550,
        gstBreakup: {
          cgstRate: 1.5,
          sgstRate: 1.5,
          igstRate: 0,
          cgstAmount: 68.25,
          sgstAmount: 68.25,
          igstAmount: 0,
          totalGst: 136.5,
          taxableValue: 4550
        },
        grandTotal: 4687,
        status: "final",
        branchCode: "MAIN",
        tenantId: "shop-1779518126045-txlhr",
        financialYear: "FY2026-27",
        createdAt: new Date("2026-07-13T09:15:00Z"),
        updatedAt: new Date("2026-07-13T09:15:00Z")
      }
    ];

    const result = await collection.insertMany(mockInvoices);
    console.log(`Successfully added ${result.insertedCount} mock invoices to 'retailer.invoices'!`);

    // Let's print out what the aggregation would yield
    const gstAgg = await collection.aggregate([
      { $match: { status: "final", tenantId: "shop-1779518126045-txlhr" } },
      {
        $group: {
          _id: null,
          totalOutputGst: { $sum: "$gstBreakup.totalGst" },
          totalTaxableValue: { $sum: "$gstBreakup.taxableValue" },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    console.log("Current Aggregated Output:", gstAgg[0]);

  } catch (error) {
    console.error("Error adding mock invoices:", error);
  } finally {
    await client.close();
  }
}

addInvoices();
