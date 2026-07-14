import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Customer } from "../retailer/models/index.js";
import { tenantLocalStorage } from "../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

async function testQuery() {
  const uri = process.env.MONGODB_URI || "";
  console.log("Connecting mongoose to:", uri ? "MongoDB Atlas" : "Empty");
  await mongoose.connect(uri);

  try {
    const customerId = "6a4e3a8f14275e172a363a4a";
    const tenantId = "shop-1779518126045-txlhr";

    // Run query inside tenantLocalStorage context
    await tenantLocalStorage.run({ tenantId }, async () => {
      console.log("Querying with tenantId:", tenantId);
      
      const customer = await Customer.findOne({ _id: customerId, tenantId });
      console.log("Found Customer:", customer ? {
        _id: customer._id,
        name: customer.name,
        tenantId: customer.tenantId,
        panNumber: customer.panNumber,
        panStatus: customer.panStatus
      } : "null");

      // Also let's print all customer IDs in the collection mapped by Mongoose
      const all = await Customer.find({});
      console.log(`Mongoose found ${all.length} total customers:`);
      all.forEach(c => {
        console.log(`- ID: ${c._id.toString()} | Name: ${c.name} | tenantId: ${c.tenantId}`);
      });
    });

  } catch (error) {
    console.error("Query Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

testQuery();
