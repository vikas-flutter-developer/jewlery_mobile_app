import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env.local') });

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const customerDb = mongoose.connection.useDb('customer');
  const checkouts = await customerDb.collection('portalcheckouts').find({}).toArray();
  const orders = await customerDb.collection('orders').find({}).toArray();
  const schemes = await customerDb.collection('schemeenrollments').find({}).toArray();

  console.log('--- CHECKOUTS ---');
  console.dir(checkouts, { depth: null });

  console.log('--- ORDERS ---');
  console.dir(orders, { depth: null });

  console.log('--- SCHEMES ---');
  console.dir(schemes, { depth: null });

  await mongoose.disconnect();
}

run().catch(console.error);
