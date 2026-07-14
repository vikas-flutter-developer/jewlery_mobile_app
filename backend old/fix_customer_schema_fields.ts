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

async function fixCustomers() {
  const uri = process.env.MONGODB_URI || "";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("retailer");
    const collection = db.collection("customers");

    // 1. Rename customerName to name, set status to ACTIVE
    const result1 = await collection.updateMany(
      { customerName: { $exists: true } },
      [
        {
          $set: {
            name: "$customerName",
            status: "ACTIVE"
          }
        }
      ]
    );

    // 2. For any document where status is lowercase "active", make it "ACTIVE"
    const result2 = await collection.updateMany(
      { status: "active" },
      { $set: { status: "ACTIVE" } }
    );

    console.log(`Successfully renamed customerName to name in ${result1.modifiedCount} documents!`);
    console.log(`Successfully updated status to ACTIVE in ${result2.modifiedCount} documents!`);

  } catch (error) {
    console.error("Error fixing customer documents:", error);
  } finally {
    await client.close();
  }
}

fixCustomers();
