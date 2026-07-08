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
  const db = mongoose.connection.useDb('super_admin');
  const sub = await db.collection('subscriptions').findOne({ email: 'mahalebhavesh247@gmail.com' });
  console.log('Subscription details:', JSON.stringify(sub, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
