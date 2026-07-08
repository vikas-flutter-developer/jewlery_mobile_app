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

  // List all databases
  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name));

  const superAdminDb = mongoose.connection.useDb('super_admin');
  const subscriptions = await superAdminDb.collection('subscriptions').find({}).toArray();
  console.log('Subscriptions:', subscriptions.map(s => ({ id: s.id, shopName: s.shopName, email: s.email, storeType: s.storeType })));

  const { RetailerOrder } = await import('../retailer/models/index.js');
  const { tenantLocalStorage } = await import('../lib/db.js');

  await new Promise((resolve) => {
    tenantLocalStorage.run({ tenantId: 'shop-1779518126045-txlhr' }, async () => {
      try {
        const queryOrders = await RetailerOrder.find({
          manufacturerId: { $in: ['shop-1779518126045-txlhr'] }
        }).lean();
        console.log('Query result via RetailerOrder model:', queryOrders);
      } catch (err) {
        console.error('Mongoose query failed:', err);
      }
      resolve();
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
