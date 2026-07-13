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
    const inventories = await db.collection('inventory').find({}).toArray();
    console.log(`\n--- Inventory in database: ${dbName} (Count: ${inventories.length}) ---`);
    inventories.forEach(item => {
      console.log(`  - SKU: ${item.sku}, Name: ${item.name}, Barcode: ${item.barcode}, BranchId: ${item.branchId}`);
    });

    const rates = await db.collection('rates').find({}).toArray();
    console.log(`--- Rates in database: ${dbName} (Count: ${rates.length}) ---`);
    rates.forEach(r => {
      console.log(`  - Metal: ${r.metal}, Rate: ${r.rate}`);
    });
  }

  await mongoose.disconnect();
}

run().catch(console.error);
