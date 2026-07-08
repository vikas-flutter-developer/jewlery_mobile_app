import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

async function query() {
  const client = new MongoClient(process.env.MONGODB_URI || "");
  try {
    await client.connect();
    const db = client.db("manufacturer");
    
    console.log("=== USERS IN MANUFACTURER ===");
    const users = await db.collection("users").find({}).toArray();
    users.forEach(u => console.log(`User: ${u.name}, Email: ${u.email}, Role: ${u.role}, _id: ${u._id}`));

    console.log("\n=== KARIKARS IN MANUFACTURER ===");
    const karikars = await db.collection("karikars").find({}).toArray();
    karikars.forEach(k => console.log(`Karikar: ${k.name}, Email: ${k.email}, _id: ${k._id}, goldStock: ${k.goldStock}, jobCardsCount: ${k.jobCards?.length}`));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

query();
