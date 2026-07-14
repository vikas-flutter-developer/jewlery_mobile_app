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

const TARGET_TENANT = "shop-1779518126045-txlhr";

async function updateAllTenants() {
  const uri = process.env.MONGODB_URI || "";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("retailer");
    
    const collections = [
      "referralpartners",
      "referralleads",
      "referralcommissions",
      "referralpayoutledgers",
      "vendorratecontracts",
      "vendorraterules",
      "vendors"
    ];

    for (const colName of collections) {
      const collection = db.collection(colName);
      const result = await collection.updateMany(
        { tenantId: "default-shop" },
        { $set: { tenantId: TARGET_TENANT } }
      );
      console.log(`Collection '${colName}': Updated ${result.modifiedCount} documents to tenantId '${TARGET_TENANT}' (matched: ${result.matchedCount})`);
    }

  } catch (error) {
    console.error("Error updating tenants:", error);
  } finally {
    await client.close();
  }
}

updateAllTenants();
