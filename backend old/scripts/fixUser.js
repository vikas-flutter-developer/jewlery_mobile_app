import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), path.basename(process.cwd()) === 'backend' ? '.' : 'backend', '.env.local') });

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  let storeId = '';
  let storeType = '';
  let phone = '';
  let ownerName = '';

  const superAdminDb = mongoose.connection.useDb('super_admin');
  const sub = await superAdminDb.collection('subscriptions').findOne({ email: 'mahalebhavesh247@gmail.com' });
  if (sub) {
    storeId = sub.id;
    storeType = sub.storeType;
    phone = sub.phone || '';
    ownerName = sub.ownerName || '';
    console.log('Found subscription in MongoDB:', storeId, storeType);
  } else {
    // Check platformStore.json
    const platformPath = path.resolve(process.cwd(), path.basename(process.cwd()) === 'backend' ? '.' : 'backend', 'data', 'platformStore.json');
    if (fs.existsSync(platformPath)) {
      const platformData = JSON.parse(fs.readFileSync(platformPath, 'utf8'));
      const activeStore = (platformData.stores || []).find(s => s.email?.toLowerCase() === 'mahalebhavesh247@gmail.com' && s.status === 'ACTIVE');
      if (activeStore) {
        storeId = activeStore.id;
        storeType = activeStore.storeType;
        phone = activeStore.phone || '';
        ownerName = activeStore.ownerName || '';
        console.log('Found subscription in platformStore.json:', storeId, storeType);
      }
    }
  }

  if (!storeId) {
    console.error('No subscription found in DB or platformStore.json');
    await mongoose.disconnect();
    return;
  }

  const rawPassword = phone.slice(-4) || 'Pass@1234';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  const userRole = storeType === 'MANUFACTURER' ? 'ADMIN' : 'RETAILER';

  // 1. Update MongoDB databases
  const targetDbName = storeType === 'MANUFACTURER' ? 'manufacturer' : 'retailer';
  const db = mongoose.connection.useDb(targetDbName);
  
  const updated = await db.collection('users').updateOne(
    { email: 'mahalebhavesh247@gmail.com' },
    {
      $set: {
        name: ownerName || 'bnm',
        role: userRole,
        tenantId: storeId,
        password: hashedPassword,
        status: 'ACTIVE',
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('MongoDB user updated:', updated);

  // 2. Update fallbackStore.json
  const storePath = path.resolve(process.cwd(), path.basename(process.cwd()) === 'backend' ? '.' : 'backend', 'data', 'fallbackStore.json');
  if (fs.existsSync(storePath)) {
    const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    storeData.users = storeData.users || [];
    let fbUser = storeData.users.find(u => u.email === 'mahalebhavesh247@gmail.com');
    if (fbUser) {
      fbUser.role = userRole;
      fbUser.tenantId = storeId;
      fbUser.password = hashedPassword;
      fbUser.status = 'ACTIVE';
      fbUser.updatedAt = new Date().toISOString();
    } else {
      fbUser = {
        _id: `user-${Date.now()}`,
        name: ownerName || 'Owner',
        email: 'mahalebhavesh247@gmail.com',
        phone: phone || '',
        password: hashedPassword,
        role: userRole,
        tenantId: storeId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      storeData.users.push(fbUser);
    }
    fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2), 'utf8');
    console.log('fallbackStore.json updated');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
