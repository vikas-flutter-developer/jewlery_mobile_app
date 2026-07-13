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

  const dbNames = ['customer', 'retailer', 'manufacturer', 'super_admin'];
  for (const dbName of dbNames) {
    console.log(`\n=== Checking DB: ${dbName} ===`);
    const db = mongoose.connection.useDb(dbName);
    const collections = await db.db.listCollections().toArray();
    for (const collInfo of collections) {
      const coll = db.collection(collInfo.name);
      const doc = await coll.findOne({ email: 'mahalebhavesh247@gmail.com' });
      if (doc) {
        console.log(`Found in collection "${collInfo.name}":`, doc);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
