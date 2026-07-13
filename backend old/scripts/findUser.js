import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const EMAIL = process.env.QUERY_EMAIL || process.argv[2] || 'mahalebhavesh247@gmail.com';

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in .env.local');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI, { w: 'majority' });
  console.log('Connected to Mongo');

  const retailerDb = mongoose.connection.useDb('retailer', { useCache: true });
  const manufacturerDb = mongoose.connection.useDb('manufacturer', { useCache: true });

  const rUser = await retailerDb.collection('users').findOne({ email: EMAIL });
  const mUser = await manufacturerDb.collection('users').findOne({ email: EMAIL });

  console.log('Retailer DB user:', rUser ? { _id: rUser._id, email: rUser.email, tenantId: rUser.tenantId, password: rUser.password } : null);
  console.log('Manufacturer DB user:', mUser ? { _id: mUser._id, email: mUser.email, tenantId: mUser.tenantId, password: mUser.password } : null);

  const subDb = mongoose.connection.useDb('super_admin', { useCache: true });
  const sub = await subDb.collection('subscriptions').findOne({ email: EMAIL });
  console.log('Subscription record in super_admin:', sub ? { id: sub.id, email: sub.email, status: sub.status } : null);

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
