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

  const superAdminDb = mongoose.connection.useDb('super_admin');
  const subs = await superAdminDb.collection('subscriptions').find({}).toArray();
  console.log('--- SUBSCRIPTIONS ---');
  console.log(subs.map(s => ({
    id: s.id,
    email: s.email,
    storeType: s.storeType,
    status: s.status,
    phone: s.phone
  })));

  const retailerDb = mongoose.connection.useDb('retailer');
  const rUsers = await retailerDb.collection('users').find({}).toArray();
  console.log('--- RETAILER USERS ---');
  console.log(rUsers.map(u => ({
    email: u.email,
    role: u.role,
    tenantId: u.tenantId,
    status: u.status
  })));

  const manufacturerDb = mongoose.connection.useDb('manufacturer');
  const mUsers = await manufacturerDb.collection('users').find({}).toArray();
  console.log('--- MANUFACTURER USERS ---');
  console.log(mUsers.map(u => ({
    email: u.email,
    role: u.role,
    tenantId: u.tenantId,
    status: u.status
  })));

  await mongoose.disconnect();
}

run().catch(console.error);
