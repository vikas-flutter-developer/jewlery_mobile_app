import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, ".env") });
}

const TARGET_TENANT = "shop-1779518126045-txlhr";

const generateRandomPan = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nums = "0123456789";
  let pan = "";
  for (let i = 0; i < 5; i++) pan += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) pan += nums[Math.floor(Math.random() * nums.length)];
  pan += chars[Math.floor(Math.random() * chars.length)];
  return pan;
};

async function seedCustomerReferrals() {
  const uri = process.env.MONGODB_URI || "";
  console.log(`Connecting to MongoDB at: ${uri}`);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("retailer");

    const customersCol = db.collection("customers");
    const referralsCol = db.collection("customerreferrals");

    console.log("Seeding Customer Referrals...");

    // 1. Find or create the main customer with phone 7558556969
    let mainCustomer = await customersCol.findOne({ phone: "7558556969", tenantId: TARGET_TENANT });
    if (!mainCustomer) {
      mainCustomer = await customersCol.findOne({ phone: "7558556969" });
    }

    const mainCustomerId = mainCustomer ? mainCustomer._id : new ObjectId();

    if (mainCustomer) {
      await customersCol.updateOne(
        { _id: mainCustomerId },
        {
          $set: {
            name: "Gold Customer",
            email: "customer@example.com",
            referredBy: "GOLD-SHARE-77",
            tenantId: TARGET_TENANT,
            status: "ACTIVE",
            panNumber: mainCustomer.panNumber || generateRandomPan()
          }
        }
      );
      console.log(`Updated existing customer 7558556969 ID: ${mainCustomerId.toString()}`);
    } else {
      await customersCol.insertOne({
        _id: mainCustomerId,
        name: "Gold Customer",
        phone: "7558556969",
        email: "customer@example.com",
        referredBy: "GOLD-SHARE-77",
        tenantId: TARGET_TENANT,
        status: "ACTIVE",
        panNumber: generateRandomPan(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Created new customer 7558556969 ID: ${mainCustomerId.toString()}`);
    }

    // 2. Create the 5 referred friends in the Customer collection
    const friends = [
      { name: "Ananya Sen", phone: "9876543211", status: "CONVERTED" },
      { name: "Priya Patel", phone: "9876543213", status: "CONVERTED" },
      { name: "Rohan Deshmukh", phone: "9876543212", status: "CONTACTED" },
      { name: "Amit Shah", phone: "9876543214", status: "LEAD" },
      { name: "Siddharth Rao", phone: "9876543215", status: "CONTACTED" }
    ];

    const friendIds: { [name: string]: ObjectId } = {};

    for (const friend of friends) {
      let existingFriend = await customersCol.findOne({ phone: friend.phone, tenantId: TARGET_TENANT });
      const fId = existingFriend ? existingFriend._id : new ObjectId();
      friendIds[friend.name] = fId;

      await customersCol.updateOne(
        { _id: fId },
        {
          $set: {
            name: friend.name,
            phone: friend.phone,
            tenantId: TARGET_TENANT,
            status: "ACTIVE",
            panNumber: existingFriend?.panNumber || generateRandomPan(),
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      console.log(`Seeded friend profile for ${friend.name} ID: ${fId.toString()}`);
    }

    // 3. Clear and insert CustomerReferral records for the main customer
    await referralsCol.deleteMany({ referrerCustomerId: mainCustomerId });
    console.log("Cleared old referrals for this customer");

    const referralsToInsert = [
      {
        referrerCustomerId: mainCustomerId,
        referredCustomerId: friendIds["Ananya Sen"],
        referralCode: "GOLD-SHARE-77",
        referralStatus: "QUALIFIED",
        rewardType: "POINTS",
        rewardValue: 1000,
        rewardStatus: "REDEEMED",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        referrerCustomerId: mainCustomerId,
        referredCustomerId: friendIds["Priya Patel"],
        referralCode: "GOLD-SHARE-77",
        referralStatus: "QUALIFIED",
        rewardType: "POINTS",
        rewardValue: 500,
        rewardStatus: "ISSUED",
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        referrerCustomerId: mainCustomerId,
        referredCustomerId: friendIds["Rohan Deshmukh"],
        referralCode: "GOLD-SHARE-77",
        referralStatus: "PENDING",
        rewardType: "POINTS",
        rewardValue: 0,
        rewardStatus: "NONE",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        referrerCustomerId: mainCustomerId,
        referredCustomerId: friendIds["Amit Shah"],
        referralCode: "GOLD-SHARE-77",
        referralStatus: "PENDING",
        rewardType: "POINTS",
        rewardValue: 0,
        rewardStatus: "NONE",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        referrerCustomerId: mainCustomerId,
        referredCustomerId: friendIds["Siddharth Rao"],
        referralCode: "GOLD-SHARE-77",
        referralStatus: "PENDING",
        rewardType: "POINTS",
        rewardValue: 0,
        rewardStatus: "NONE",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ];

    await referralsCol.insertMany(referralsToInsert);
    console.log("Seeded 5 CustomerReferral documents!");

  } finally {
    await client.close();
    console.log("Database connection closed.");
  }
}

seedCustomerReferrals().catch(console.error);
