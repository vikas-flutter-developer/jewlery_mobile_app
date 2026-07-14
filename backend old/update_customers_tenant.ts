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

async function updateCustomers() {
  const uri = process.env.MONGODB_URI || "";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("retailer");
    const collection = db.collection("customers");

    // Only update Amit Sharma (ID: 6a4e3a8f14275e172a363a4a) to have the tenantId
    const result = await collection.updateOne(
      { _id: new ObjectId("6a4e3a8f14275e172a363a4a") },
      { $set: { tenantId: "shop-1779518126045-txlhr" } }
    );
    console.log(`Successfully updated Amit Sharma's customer document with tenantId (matched count: ${result.matchedCount}, modified count: ${result.modifiedCount})`);

  } catch (error) {
    console.error("Error updating customers:", error);
  } finally {
    await client.close();
  }
}

updateCustomers();
