import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const dbs = [
    'retailer',
    'retailer_store-ret1',
    'retailer_store-ret2'
  ];

  for (const dbName of dbs) {
    const db = mongoose.connection.useDb(dbName);
    const result = await db.collection('customers').deleteMany({ phone: '7558556969' });
    console.log(`Deleted ${result.deletedCount} test customer(s) from database: ${dbName}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
