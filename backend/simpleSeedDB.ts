import { MongoClient, ObjectId } from "mongodb";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI || "";

interface SeedCollection {
  name: string;
  file: string;
  dataKey?: string;
}

interface SeedConfig {
  database: string;
  dbName: string;
  collections: SeedCollection[];
  dataPath: string;
}

const seedConfigs: SeedConfig[] = [
  {
    database: "manufacturer",
    dbName: "manufacturer",
    dataPath: path.resolve(__dirname, "data", "manufacturer"),
    collections: [
      { name: "branches", file: "branches.json", dataKey: "branches" },
      { name: "rates", file: "rates.json", dataKey: "rates" },
      { name: "inventory", file: "inventory.json", dataKey: "inventory" },
      { name: "barcodes", file: "barcodes.json", dataKey: "barcodes" },
      { name: "catalog", file: "catalog.json", dataKey: "catalog" },
      { name: "gemstones", file: "gemstones.json", dataKey: "gemstones" },
      { name: "advanceinventories", file: "advanceInventory.json", dataKey: "advanceInventory" },
      { name: "vendors", file: "vendors.json", dataKey: "vendors" },
      { name: "vendororders", file: "vendors.json", dataKey: "vendorOrders" },
      { name: "karikars", file: "karikars.json", dataKey: "karikar" },
      { name: "karikariorders", file: "karikars.json", dataKey: "karikariOrders" },
      { name: "orders", file: "orders.json", dataKey: "orders" },
      { name: "retailerorders", file: "retailerorders.json", dataKey: "retailerorders" },
      { name: "sales", file: "sales.json", dataKey: "sales" },
      { name: "wholesale", file: "wholesale.json", dataKey: "wholesale" },
      { name: "returns", file: "returns.json", dataKey: "returns" },
      { name: "khata", file: "khata.json", dataKey: "khata" },
      { name: "schemes", file: "schemes.json", dataKey: "schemes" },
      { name: "oldgold", file: "oldGoldExchange.json", dataKey: "oldGoldExchange" },
      { name: "offers", file: "offers.json", dataKey: "offers" },
      { name: "users", file: "users.json", dataKey: "users" },
      { name: "compliance", file: "compliance.json", dataKey: "compliance" },
      { name: "hallmarking", file: "hallmarking.json", dataKey: "hallmarking" },
      { name: "accounting", file: "accounting.json", dataKey: "accounting" },
      { name: "subscriptions", file: "subscriptions.json", dataKey: "subscriptions" },
      { name: "userroles", file: "userRoles.json", dataKey: "userRoles" }
    ]
  },
  {
    database: "retailer",
    dbName: "retailer",
    dataPath: path.resolve(__dirname, "data", "retailer"),
    collections: [
      { name: "retailerorders", file: "retailOrders.json", dataKey: "retailOrders" },
      { name: "sales", file: "sales.json", dataKey: "sales" },
      { name: "salesreturns", file: "salesReturns.json", dataKey: "salesReturns" },
      { name: "salesexchange", file: "salesReturns.json", dataKey: "salesExchange" },
      { name: "branches", file: "branches.json", dataKey: "branches" },
      { name: "inventory", file: "inventory.json", dataKey: "inventory" },
      { name: "advanceinventories", file: "advanceInventory.json", dataKey: "advanceInventory" },
      { name: "barcodes", file: "barcodes.json", dataKey: "barcodes" },
      { name: "customers", file: "customers.json", dataKey: "customers" },
      { name: "schemes", file: "schemes.json", dataKey: "schemes" },
      { name: "subscriptions", file: "subscriptions.json", dataKey: "subscriptions" },
      { name: "users", file: "users.json", dataKey: "users" },
      { name: "userroles", file: "userRoles.json", dataKey: "userRoles" },
      { name: "tasks", file: "tasks.json", dataKey: "tasks" }
    ]
  },
  {
    database: "customer",
    dbName: "customer",
    dataPath: path.resolve(__dirname, "data", "customer"),
    collections: [
      { name: "customers", file: "customers.json", dataKey: "customers" },
      { name: "customerorders", file: "customerOrders.json", dataKey: "customerOrders" },
      { name: "schemedefinitions", file: "schemes.json", dataKey: "schemes" },
      { name: "schemeenrollments", file: "enrollments.json", dataKey: "enrollments" },
      { name: "portalcheckouts", file: "portalCheckouts.json", dataKey: "portalCheckouts" },
      { name: "customeraccounts", file: "customerAccounts.json", dataKey: "customerAccounts" },
      { name: "customerloyaltypoints", file: "loyaltyPoints.json", dataKey: "loyaltyPoints" },
      { name: "ledgerhistories", file: "ledgerHistory.json", dataKey: "ledgerHistory" }
    ]
  },
  {
    database: "superadmin",
    dbName: "super_admin",
    dataPath: path.resolve(__dirname, "data", "superadmin"),
    collections: [
      { name: "subscriptions", file: "subscriptions.json", dataKey: "subscriptions" },
      { name: "demoaccesses", file: "demoaccess.json", dataKey: "demoaccess" },
      { name: "globalusers", file: "users.json", dataKey: "adminUsers" },
      { name: "supporttickets", file: "tickets.json", dataKey: "tickets" },
      { name: "securityaudits", file: "audits.json", dataKey: "audits" }
    ]
  }
];

async function seedAllDatabases() {
  const client = new MongoClient(MONGODB_URI);

  console.log("\n================================================================================");
  console.log("🌱 SEEDING ALL MONGODB DATABASES");
  console.log("================================================================================\n");

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas\n");

    for (const config of seedConfigs) {
      const db = client.db(config.dbName);
      
      console.log(`📁 ${config.database.toUpperCase()} Database (${config.dbName})`);
      console.log("-----------------------------------------------");

      let collectionCount = 0;
      let totalRecords = 0;

      for (const collection of config.collections) {
        const filePath = path.join(config.dataPath, collection.file);

        if (!fs.existsSync(filePath)) {
          console.log(`  ⚠️  ${collection.name}: File not found`);
          continue;
        }

        try {
          const rawData = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(rawData);
          const dataArray = data[collection.dataKey || collection.name] || [];

          if (Array.isArray(dataArray) && dataArray.length > 0) {
            const col = db.collection(collection.name);
            await col.deleteMany({});
            
            const karikarIdMap: { [email: string]: ObjectId } = {
              "bhavesh_karigar@gmail.com": new ObjectId("6a4e30be7b9841beb6355b97"),
              "raj_karigar@gmail.com": new ObjectId("6a4e30be7b9841beb6355b95"),
              "priya_karigar@gmail.com": new ObjectId("6a4e30be7b9841beb6355b96"),
              "ramesh_karigar@gmail.com": new ObjectId("6a4e30be7b9841beb6355b98"),
              "suresh_karigar@gmail.com": new ObjectId("6a4e30be7b9841beb6355b99")
            };

            let recordsToInsert = dataArray;
            if (collection.name === "globalusers") {
              const hashedPassword = await bcrypt.hash("superadmin", 10);
              recordsToInsert = dataArray.map((user: any) => ({
                _id: new ObjectId(),
                name: user.userName || user.name || "Super Admin",
                email: (user.email || "admin@aurajewel.com").toLowerCase(),
                password: hashedPassword,
                phone: user.phone || "7558556969",
                role: (user.roleName === "Super Admin" || user.role === "SUPER_ADMIN") ? "SUPER_ADMIN" : "ADMIN",
                status: "ACTIVE",
                createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }));
            } else if (collection.name === "users") {
              recordsToInsert = dataArray.map((user: any) => {
                const password = user.password || (config.database === "retailer" ? "retailer" : "manufacturer");
                const hashedPassword = bcrypt.hashSync(password, 10);
                const emailLower = (user.email || "").toLowerCase();
                const matchedId = karikarIdMap[emailLower] || new ObjectId();
                return {
                  _id: matchedId,
                  name: user.name || (config.database === "retailer" ? "System Retailer" : "System Manufacturer"),
                  email: emailLower,
                  password: hashedPassword,
                  phone: user.phone || "7558556969",
                  role: user.role || (config.database === "retailer" ? "RETAILER" : "ADMIN"),
                  status: "ACTIVE",
                  permissions: user.permissions || [],
                  branchId: user.branchId || null,
                  tenantId: user.tenantId || null,
                  createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
              });
            } else if (collection.name === "karikars") {
              recordsToInsert = dataArray.map((k: any) => {
                const emailLower = (k.email || "").toLowerCase();
                const matchedId = karikarIdMap[emailLower] || new ObjectId();

                // Build rich demo data
                let goldStock = 0;
                let ledgerBalance = 0;
                let jobCards: any[] = [];
                let metalReturns: any[] = [];
                let settlements: any[] = [];

                if (emailLower === "bhavesh_karigar@gmail.com") {
                  goldStock = 48.75;
                  ledgerBalance = 12500;
                  jobCards = [
                    { _id: "JC-901", orderId: "ORD-2026-901", jewelryType: "Gold Antique Necklace", purity: "22K", issuedGoldWeight: 22.5, status: "OPEN", dueDate: "2026-07-15", issuedAt: new Date().toISOString() },
                    { _id: "JC-902", orderId: "ORD-2026-902", jewelryType: "Polished Gold Bangles", purity: "22K", issuedGoldWeight: 18.0, status: "OPEN", dueDate: "2026-07-18", issuedAt: new Date().toISOString() },
                    { _id: "JC-903", orderId: "ORD-2026-903", jewelryType: "Solitaire Diamond Ring Frame", purity: "18K", issuedGoldWeight: 4.5, status: "OPEN", dueDate: "2026-07-20", issuedAt: new Date().toISOString() },
                    { _id: "JC-904", orderId: "ORD-2026-904", jewelryType: "Bridal Choker Chasing", purity: "22K", issuedGoldWeight: 35.0, status: "COMPLETED", dueDate: "2026-07-04", issuedAt: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
                    { _id: "JC-905", orderId: "ORD-2026-905", jewelryType: "Gold Stud Earrings", purity: "22K", issuedGoldWeight: 6.2, status: "RECEIVED", dueDate: "2026-07-01", issuedAt: new Date(Date.now() - 10*24*60*60*1000).toISOString() },
                    { _id: "JC-906", orderId: "ORD-2026-906", jewelryType: "Gold Pendant Frame", purity: "18K", issuedGoldWeight: 5.0, status: "RECEIVED", dueDate: "2026-06-28", issuedAt: new Date(Date.now() - 12*24*60*60*1000).toISOString() }
                  ];
                  metalReturns = [
                    { _id: "RET-001", weight: 20.0, purity: "22K", note: "Returned scrap from JC-905", status: "COMPLETED", createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
                    { _id: "RET-002", weight: 15.0, purity: "22K", note: "Completed casting excess return", status: "COMPLETED", createdAt: new Date(Date.now() - 3*24*60*60*1000).toISOString() },
                    { _id: "RET-003", weight: 5.5, purity: "18K", note: "End of month excess metal tally", status: "PENDING", createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString() }
                  ];
                  settlements = [
                    { _id: "SET-001", amount: 8000.0, type: "CREDIT", paymentMethod: "BANK_TRANSFER", note: "Job Order #JC-905 completed making charges", createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
                    { _id: "SET-002", amount: 5000.0, type: "DEBIT", paymentMethod: "CASH", note: "Weekly wage withdrawal payout", createdAt: new Date(Date.now() - 4*24*60*60*1000).toISOString() },
                    { _id: "SET-003", amount: 9500.0, type: "CREDIT", paymentMethod: "BANK_TRANSFER", note: "Making charges for Job Order #JC-906", createdAt: new Date(Date.now() - 3*24*60*60*1000).toISOString() }
                  ];
                } else if (emailLower === "raj_karigar@gmail.com") {
                  goldStock = 18.5;
                  ledgerBalance = 4800;
                  jobCards = [
                    { _id: "JC-801", orderId: "ORD-2026-801", jewelryType: "Gold Ring Engraving", purity: "22K", issuedGoldWeight: 8.5, status: "OPEN", dueDate: "2026-07-12", issuedAt: new Date().toISOString() },
                    { _id: "JC-802", orderId: "ORD-2026-802", jewelryType: "Silver Chain Polishing", purity: "Fine", issuedGoldWeight: 10.0, status: "COMPLETED", dueDate: "2026-07-06", issuedAt: new Date(Date.now() - 4*24*60*60*1000).toISOString() }
                  ];
                  metalReturns = [
                    { _id: "RET-101", weight: 5.0, purity: "22K", note: "Polishing dust return", status: "COMPLETED", createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString() }
                  ];
                  settlements = [
                    { _id: "SET-101", amount: 1500.0, type: "CREDIT", paymentMethod: "CASH", note: "Chain polishing making charges", createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString() }
                  ];
                } else if (emailLower === "priya_karigar@gmail.com") {
                  goldStock = 9.2;
                  ledgerBalance = 3100;
                  jobCards = [
                    { _id: "JC-701", orderId: "ORD-2026-701", jewelryType: "Diamond Earring Mounting", purity: "18K", issuedGoldWeight: 4.2, status: "OPEN", dueDate: "2026-07-14", issuedAt: new Date().toISOString() },
                    { _id: "JC-702", orderId: "ORD-2026-702", jewelryType: "Gold nose ring design", purity: "22K", issuedGoldWeight: 5.0, status: "OPEN", dueDate: "2026-07-16", issuedAt: new Date().toISOString() }
                  ];
                } else if (emailLower === "ramesh_karigar@gmail.com") {
                  goldStock = 15.42;
                  ledgerBalance = 3200;
                  jobCards = [
                    { _id: "JC-601", orderId: "ORD-2026-601", jewelryType: "Gold Ring Sizing", purity: "22K", issuedGoldWeight: 4.5, status: "OPEN", dueDate: "2026-07-16", issuedAt: new Date().toISOString() },
                    { _id: "JC-602", orderId: "ORD-2026-602", jewelryType: "Handmade Gold Chain", purity: "22K", issuedGoldWeight: 12.0, status: "OPEN", dueDate: "2026-07-19", issuedAt: new Date().toISOString() }
                  ];
                  metalReturns = [
                    { _id: "RET-201", weight: 2.1, purity: "22K", note: "Polished scrap return", status: "COMPLETED", createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString() }
                  ];
                  settlements = [
                    { _id: "SET-201", amount: 1200.0, type: "CREDIT", paymentMethod: "CASH", note: "Chain linking task payout", createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString() }
                  ];
                } else if (emailLower === "suresh_karigar@gmail.com") {
                  goldStock = 5.1;
                  ledgerBalance = 8900;
                  jobCards = [
                    { _id: "JC-501", orderId: "ORD-2026-501", jewelryType: "Ruby Pendant Stone Setting", purity: "18K", issuedGoldWeight: 5.1, status: "OPEN", dueDate: "2026-07-15", issuedAt: new Date().toISOString() }
                  ];
                }

                return {
                  _id: matchedId,
                  name: k.name,
                  email: emailLower,
                  goldStock,
                  ledgerBalance,
                  jobCards,
                  metalReturns,
                  settlements,
                  location: k.location || "Factory",
                  phone: k.phoneNumber || "9000100021",
                  status: k.status?.toUpperCase() || "ACTIVE",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
              });
            }
            
            const result = await col.insertMany(recordsToInsert);
            console.log(`  ✅ ${collection.name}: ${Object.keys(result.insertedIds).length} records`);
            collectionCount++;
            totalRecords += Object.keys(result.insertedIds).length;
          }
        } catch (error: any) {
          console.log(`  ❌ ${collection.name}: ${error.message}`);
        }
      }

      console.log(`\n  📊 Subtotal: ${collectionCount} collections, ${totalRecords} records\n`);
    }

    await client.close();

    console.log("================================================================================");
    console.log("✅ ALL DATABASES SEEDED SUCCESSFULLY");
    console.log("================================================================================\n");
    console.log("📊 Database Structure Created:");
    console.log("  ✨ manufacturer: Gemstones, Barcodes, Offers, Schemes, Orders, Vendors");
    console.log("  ✨ retailer: Retail Orders, Sales, Returns & Exchanges");
    console.log("  ✨ customer: Customers, Customer Orders");
    console.log("  ✨ super_admin: Branches, Users, Roles, Vendors\n");
    console.log("🎉 Your MongoDB Atlas is now organized and ready to use!\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedAllDatabases();
