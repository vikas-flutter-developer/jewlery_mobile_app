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

async function addHuidInventory() {
  const uri = process.env.MONGODB_URI || "";
  console.log("Connecting to:", uri ? "MongoDB Atlas URI" : "Empty URI");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    // Manufacturer inventory is stored in the 'manufacturer' database
    const db = client.db("manufacturer");
    const collection = db.collection("inventory");

    // Clean existing test item first if it exists
    await collection.deleteOne({ sku: "SKU-TEST-OPULENT-RING-009" });

    const newInventoryItem = {
      _id: new ObjectId(),
      sku: "SKU-TEST-OPULENT-RING-009",
      grossWeight: 6.8,
      netWeight: 6.5,
      purity: "22K",
      fineWeight: 5.95,
      diamondWeight: 0,
      huid: "", // Empty = Non-compliant / Missing HUID
      huidNumber: "",
      huidStatus: "MISSING_HUID",
      branchId: "MAIN",
      barcode: "BARCODE-TEST-HUID-4",
      tag: "TAG-TEST-HUID-4",
      name: "Opulent Ruby Ring 22K",
      type: "GOLD",
      status: "In Stock",
      stock: 5,
      price: 54000,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(newInventoryItem);
    console.log(`Successfully added 4th non-compliant inventory item (ID: ${result.insertedId}) to 'manufacturer.inventory'!`);

  } catch (error) {
    console.error("Error adding mock inventory item:", error);
  } finally {
    await client.close();
  }
}

addHuidInventory();
