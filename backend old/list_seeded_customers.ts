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

async function listCustomers() {
  const uri = process.env.MONGODB_URI || "";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("retailer");
    const collection = db.collection("customers");

    const customers = await collection.find({}).toArray();
    console.log("=== CUSTOMERS IN RETAILER DATABASE ===");
    customers.forEach((cust) => {
      console.log(`ID: ${cust._id.toString()} | Name: ${cust.name || cust.customerName} | Phone: ${cust.phone}`);
    });

  } catch (error) {
    console.error("Error listing customers:", error);
  } finally {
    await client.close();
  }
}

listCustomers();
