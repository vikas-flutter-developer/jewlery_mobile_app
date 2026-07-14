import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, ".env") });
}

async function addTcs() {
  const uri = process.env.MONGODB_URI || "";
  console.log("Connecting to:", uri ? "MongoDB Atlas URI" : "Empty URI");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("retailer");

    // 1. Seed FinancialYear document so it is present and active
    const fyCollection = db.collection("financialyears");
    await fyCollection.deleteMany({ code: { $in: ["2026-27", "FY2026-27"] } });
    await fyCollection.insertOne({
      _id: new ObjectId(),
      code: "2026-27",
      name: "FY 2026-27",
      startDate: new Date("2026-04-01T00:00:00Z"),
      endDate: new Date("2027-03-31T23:59:59Z"),
      status: "ACTIVE",
      isDefault: true,
      tenantId: "shop-1779518126045-txlhr",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Successfully seeded active FinancialYear '2026-27'");

    // 2. Seed TCS transactions matching the exact financialYearId
    const tcsCollection = db.collection("tcstransactions");
    await tcsCollection.deleteMany({ invoiceId: { $in: ["INV-2026-0001", "INV-2026-0002", "INV-2026-0003"] } });

    const mockTcs = [
      {
        _id: new ObjectId(),
        invoiceId: "INV-2026-0001",
        customerId: "CUST-9901",
        financialYearId: "2026-27", // match default getCurrentFinancialYear() fallback
        taxableAmount: 250000,
        tcsRate: 1,
        tcsAmount: 2500,
        status: "COLLECTED",
        remarks: "Threshold crossed; TCS collected in full",
        tenantId: "shop-1779518126045-txlhr",
        transactionDate: new Date("2026-07-01T10:00:00Z"),
        createdAt: new Date("2026-07-01T10:00:00Z"),
        updatedAt: new Date("2026-07-01T10:00:00Z")
      },
      {
        _id: new ObjectId(),
        invoiceId: "INV-2026-0002",
        customerId: "CUST-9902",
        financialYearId: "2026-27",
        taxableAmount: 350000,
        tcsRate: 1,
        tcsAmount: 3500,
        status: "PENDING",
        remarks: "Awaiting bank verification of cheque payment",
        tenantId: "shop-1779518126045-txlhr",
        transactionDate: new Date("2026-07-05T11:00:00Z"),
        createdAt: new Date("2026-07-05T11:00:00Z"),
        updatedAt: new Date("2026-07-05T11:00:00Z")
      },
      {
        _id: new ObjectId(),
        invoiceId: "INV-2026-0003",
        customerId: "CUST-9903",
        financialYearId: "2026-27",
        taxableAmount: 450000,
        tcsRate: 1,
        tcsAmount: 4500,
        status: "REPORTED",
        remarks: "Reported to IT Department under Q2 filing",
        tenantId: "shop-1779518126045-txlhr",
        transactionDate: new Date("2026-07-10T14:00:00Z"),
        createdAt: new Date("2026-07-10T14:00:00Z"),
        updatedAt: new Date("2026-07-10T14:00:00Z")
      }
    ];

    const result = await tcsCollection.insertMany(mockTcs);
    console.log(`Successfully added ${result.insertedCount} mock TCS entries matching FY '2026-27'!`);

  } catch (error) {
    console.error("Error seeding TCS data:", error);
  } finally {
    await client.close();
  }
}

addTcs();
