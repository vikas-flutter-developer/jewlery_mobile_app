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
  console.log('Connected to MongoDB.');

  const dbNames = ['super_admin', 'retailer', 'manufacturer'];

  for (const dbName of dbNames) {
    console.log(`\nChecking database: ${dbName}`);
    const db = mongoose.connection.useDb(dbName);
    
    // Check users collection in the database
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();
    
    for (const u of users) {
      console.log(`User: ${u.email} | Failed Attempts: ${u.failedLoginAttempts || 0} | Lockout Until: ${u.lockoutUntil}`);
      if (u.failedLoginAttempts > 0 || u.lockoutUntil) {
        console.log(`  --> Resetting failed attempts and lockout for ${u.email} in ${dbName}...`);
        await usersCollection.updateOne(
          { _id: u._id },
          { $set: { failedLoginAttempts: 0, lockoutUntil: null } }
        );
        console.log(`  --> Unlocked.`);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
