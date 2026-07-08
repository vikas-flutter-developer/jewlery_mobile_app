import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env.local") });


const MONGODB_URI = process.env.MONGODB_URI || "";

// Database configuration
const databases = {
  manufacturer: { name: "manufacturer", uri: "" },
  retailer: { name: "retailer", uri: "" },
  customer: { name: "customer", uri: "" },
  superadmin: { name: "super_admin", uri: "" }
};

// Prepare URIs
for (const [key, db] of Object.entries(databases)) {
  db.uri = MONGODB_URI.replace(/\/[^/?]+(?=\?|$)/, `/${db.name}`);
}

interface SeedCollection {
  name: string;
  file: string;
  dataKey?: string;
}

interface SeedConfig {
  database: string;
  collections: SeedCollection[];
  dataPath: string;
}

const seedConfigs: SeedConfig[] = [
  {
    database: "manufacturer",
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

async function seedDatabase() {
  console.log("\n================================================================================");
  console.log("🌱 SEEDING ALL MONGODB DATABASES");
  console.log("================================================================================\n");

  try {
    for (const config of seedConfigs) {
      const db = databases[config.database as keyof typeof databases];
      
      console.log(`\n📁 Connecting to ${db.name}...`);
      const client = new mongoose.Mongoose().createConnection(db.uri);
      
      console.log(`%c${config.database.toUpperCase()} Database`, "color: green");
      console.log("-----------------------------------");

      for (const collection of config.collections) {
        const filePath = path.join(config.dataPath, collection.file);

        if (!fs.existsSync(filePath)) {
          console.log(`  ⚠️  Missing: ${collection.name}`);
          continue;
        }

        try {
          const rawData = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(rawData);
          const dataArray = data[collection.dataKey || collection.name] || [];

          if (Array.isArray(dataArray) && dataArray.length > 0) {
            const col = client.collection(collection.name);
            await col.deleteMany({});
            
            let recordsToInsert = dataArray;
            if (collection.name === "globalusers") {
              const hashedPassword = await bcrypt.hash("superadmin", 10);
              recordsToInsert = dataArray.map((user: any) => ({
                _id: new mongoose.Types.ObjectId(),
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
              const defaultPassword = config.database === "retailer" ? "retailer" : "manufacturer";
              const prepared = [];
              for (const user of dataArray) {
                const pass = user.password || defaultPassword;
                const hashedPassword = await bcrypt.hash(pass, 10);
                prepared.push({
                  _id: new mongoose.Types.ObjectId(),
                  name: user.name || (config.database === "retailer" ? "System Retailer" : "System Manufacturer"),
                  email: (user.email || (config.database === "retailer" ? "retailer@aurajewel.com" : "manufacturer@aurajewel.com")).toLowerCase(),
                  password: hashedPassword,
                  phone: user.phone || "7558556969",
                  role: user.role || (config.database === "retailer" ? "RETAILER" : "ADMIN"),
                  status: "ACTIVE",
                  permissions: user.permissions || [],
                  branchId: user.branchId || null,
                  tenantId: user.tenantId || null,
                  createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              }
              recordsToInsert = prepared;
            }
            
            const result = await col.insertMany(recordsToInsert);
            console.log(`  ✅ ${collection.name}: ${Object.keys(result.insertedIds).length} records`);
          }
        } catch (error: any) {
          console.log(`  ❌ ${collection.name}: ${error.message}`);
        }
      }

      await client.close();
    }

    console.log("\n================================================================================");
    console.log("✅ ALL DATABASES SEEDED SUCCESSFULLY");
    console.log("================================================================================\n");
    console.log("📊 Database Overview:");
    console.log("  • manufacturer: Gemstones, Barcodes, Offers, Schemes, Orders, Vendors");
    console.log("  • retailer: Retail Orders, Sales, Returns & Exchanges");
    console.log("  • customer: Customers, Customer Orders");
    console.log("  • super_admin: Branches, Users, Roles, Vendors\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();

