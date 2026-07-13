import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const dbNames = ['manufacturer', 'manufacturer_shop-1779518126045-txlhr', 'manufacturer_store-mqaxziyy-nbgbtm'];
  for (const dbName of dbNames) {
    console.log(`\n=== DB: ${dbName} ===`);
    const db = mongoose.connection.useDb(dbName);
    const collections = await db.db.listCollections().toArray();
    for (const collInfo of collections) {
      const coll = db.collection(collInfo.name);
      const count = await coll.countDocuments();
      if (count > 0) {
        console.log(`  Collection "${collInfo.name}": ${count} docs`);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
