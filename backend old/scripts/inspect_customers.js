import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const dbs = [
    'retailer',
    'retailer_store-mq3tpqg4-ypu6ym',
    'retailer_store-ret1',
    'retailer_store-ret2'
  ];

  for (const dbName of dbs) {
    const db = mongoose.connection.useDb(dbName);
    const customers = await db.collection('customers').find({}).toArray();
    console.log(`\n--- Customers in database: ${dbName} (Count: ${customers.length}) ---`);
    customers.forEach(c => {
      console.log(`  - Name: ${c.name}, Phone: ${c.phone}, Email: ${c.email}`);
    });
  }

  await mongoose.disconnect();
}

run().catch(console.error);
