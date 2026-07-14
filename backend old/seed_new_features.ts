import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/aurajewel";
const DB_NAME = "retailer";
const SYSTEM_DB_NAME = "super_admin";

async function seed() {
  console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log("Connected successfully to database server");
    
    const db = client.db(DB_NAME);
    const superAdminDb = client.db(SYSTEM_DB_NAME);
    
    // We need some mock Vendor IDs to associate rules
    // Let's lookup existing vendors in the retailer DB or create default ones
    const vendorCollection = db.collection("vendors");
    let vendors = await vendorCollection.find().limit(2).toArray();
    
    if (vendors.length === 0) {
      console.log("No vendors found, creating 2 mock vendors first...");
      const mockVendors = [
        {
          _id: new ObjectId("6425a77fcf5b47a9e048c1a1"),
          tenantId: "default-shop",
          name: "Vardhman Gold Jewelers",
          mobile: "9876543210",
          email: "vardhman@example.com",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          _id: new ObjectId("6425a77fcf5b47a9e048c1a2"),
          tenantId: "default-shop",
          name: "Saurabh Chains Manufacturer",
          mobile: "9123456789",
          email: "saurabh@example.com",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      await vendorCollection.insertMany(mockVendors);
      vendors = mockVendors;
    }
    
    const v1_id = vendors[0]._id;
    const v2_id = vendors[1]?._id || vendors[0]._id;
    
    // ----------------------------------------------------
    // 1. Seed Vendor Rate Contracts (5 records)
    // ----------------------------------------------------
    const contractsCol = db.collection("vendorratecontracts");
    await contractsCol.deleteMany({});
    
    const today = new Date();
    const addDays = (d: Date, n: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + n);
      return copy;
    };
    
    const c1 = new ObjectId();
    const c2 = new ObjectId();
    const c3 = new ObjectId();
    const c4 = new ObjectId();
    const c5 = new ObjectId();
    
    const mockContracts = [
      {
        _id: c1,
        tenantId: "default-shop",
        contractNumber: "CON-2026-001",
        vendorId: v1_id,
        metalType: "GOLD",
        effectiveFrom: addDays(today, -30),
        effectiveTo: addDays(today, 30),
        status: "ACTIVE",
        remarks: "Premium gold chains supply rate agreement",
        createdBy: "ADMIN",
        createdAt: addDays(today, -30),
        updatedAt: addDays(today, -30)
      },
      {
        _id: c2,
        tenantId: "default-shop",
        contractNumber: "CON-2026-002",
        vendorId: v1_id,
        metalType: "SILVER",
        effectiveFrom: addDays(today, -15),
        effectiveTo: addDays(today, 15),
        status: "ACTIVE",
        remarks: "Silver articles rate agreement - expiring soon",
        createdBy: "ADMIN",
        createdAt: addDays(today, -15),
        updatedAt: addDays(today, -15)
      },
      {
        _id: c3,
        tenantId: "default-shop",
        contractNumber: "CON-2026-003",
        vendorId: v2_id,
        metalType: "GOLD",
        effectiveFrom: addDays(today, 5),
        effectiveTo: addDays(today, 60),
        status: "DRAFT",
        remarks: "New upcoming draft agreement",
        createdBy: "ADMIN",
        createdAt: today,
        updatedAt: today
      },
      {
        _id: c4,
        tenantId: "default-shop",
        contractNumber: "CON-2026-004",
        vendorId: v2_id,
        metalType: "PLATINUM",
        effectiveFrom: addDays(today, -90),
        effectiveTo: addDays(today, -10),
        status: "EXPIRED",
        remarks: "Past platinum bangles rate agreement",
        createdBy: "ADMIN",
        createdAt: addDays(today, -90),
        updatedAt: addDays(today, -10)
      },
      {
        _id: c5,
        tenantId: "default-shop",
        contractNumber: "CON-2026-005",
        vendorId: v1_id,
        metalType: "GOLD",
        effectiveFrom: addDays(today, -5),
        effectiveTo: addDays(today, 5),
        status: "CANCELLED",
        remarks: "Terminated rule contract",
        createdBy: "ADMIN",
        createdAt: addDays(today, -5),
        updatedAt: addDays(today, -2)
      }
    ];
    await contractsCol.insertMany(mockContracts);
    console.log("Seeded 5 VendorRateContracts");
    
    // ----------------------------------------------------
    // 2. Seed Vendor Rate Rules (5 records)
    // ----------------------------------------------------
    const rulesCol = db.collection("vendorraterules");
    await rulesCol.deleteMany({});
    
    const r1 = new ObjectId();
    const r2 = new ObjectId();
    const r3 = new ObjectId();
    const r4 = new ObjectId();
    const r5 = new ObjectId();
    
    const mockRules = [
      {
        _id: r1,
        tenantId: "default-shop",
        contractId: c1,
        vendorId: v1_id,
        metalType: "GOLD",
        purity: "22K",
        rateType: "FIXED_RATE",
        rateValue: 6500,
        effectiveFrom: addDays(today, -30),
        effectiveTo: addDays(today, 30),
        status: "ACTIVE",
        createdAt: addDays(today, -30),
        updatedAt: addDays(today, -30)
      },
      {
        _id: r2,
        tenantId: "default-shop",
        contractId: c1,
        vendorId: v1_id,
        metalType: "GOLD",
        purity: "18K",
        rateType: "MARKET_PLUS",
        rateValue: 150,
        effectiveFrom: addDays(today, -30),
        effectiveTo: addDays(today, 30),
        status: "ACTIVE",
        createdAt: addDays(today, -30),
        updatedAt: addDays(today, -30)
      },
      {
        _id: r3,
        tenantId: "default-shop",
        contractId: c2,
        vendorId: v1_id,
        metalType: "SILVER",
        purity: "92.5",
        rateType: "MARKET_MINUS",
        rateValue: 200,
        effectiveFrom: addDays(today, -15),
        effectiveTo: addDays(today, 15),
        status: "ACTIVE",
        createdAt: addDays(today, -15),
        updatedAt: addDays(today, -15)
      },
      {
        _id: r4,
        tenantId: "default-shop",
        contractId: c3,
        vendorId: v2_id,
        metalType: "GOLD",
        purity: "24K",
        rateType: "FIXED_RATE",
        rateValue: 7100,
        effectiveFrom: addDays(today, 5),
        effectiveTo: addDays(today, 60),
        status: "INACTIVE",
        createdAt: today,
        updatedAt: today
      },
      {
        _id: r5,
        tenantId: "default-shop",
        contractId: c4,
        vendorId: v2_id,
        metalType: "PLATINUM",
        purity: "950",
        rateType: "MARKET_PLUS",
        rateValue: 50,
        effectiveFrom: addDays(today, -90),
        effectiveTo: addDays(today, -10),
        status: "EXPIRED",
        createdAt: addDays(today, -90),
        updatedAt: addDays(today, -10)
      }
    ];
    await rulesCol.insertMany(mockRules);
    console.log("Seeded 5 VendorRateRules");
    
    // ----------------------------------------------------
    // 3. Seed Referral Partners (5 records)
    // ----------------------------------------------------
    const partnersCol = db.collection("referralpartners");
    await partnersCol.deleteMany({});
    
    const p1 = new ObjectId();
    const p2 = new ObjectId();
    const p3 = new ObjectId();
    const p4 = new ObjectId();
    const p5 = new ObjectId();
    
    const mockPartners = [
      {
        _id: p1,
        tenantId: "default-shop",
        partnerCode: "PART-AJ-001",
        partnerType: "REFERRAL_PARTNER",
        name: "Devendra Verma",
        companyName: "Verma Marketing Agency",
        mobile: "9911223344",
        email: "devendra@verma.com",
        address: "Sarafa Bazar, Indore",
        gstNumber: "23AABCV1234F1Z1",
        status: "ACTIVE",
        joinedDate: addDays(today, -60),
        remarks: "Top marketing partner Indore region",
        createdAt: addDays(today, -60),
        updatedAt: addDays(today, -60)
      },
      {
        _id: p2,
        tenantId: "default-shop",
        partnerCode: "PART-AJ-002",
        partnerType: "AGENT",
        name: "Abhishek Jain",
        companyName: "Jain Jewelry Brokers",
        mobile: "9922334455",
        email: "abhishek@jainbrokers.com",
        address: "Zaveri Bazar, Mumbai",
        gstNumber: "27AABCV5678F2Z2",
        status: "ACTIVE",
        joinedDate: addDays(today, -45),
        remarks: "Wholesale gold broker Mumbai",
        createdAt: addDays(today, -45),
        updatedAt: addDays(today, -45)
      },
      {
        _id: p3,
        tenantId: "default-shop",
        partnerCode: "PART-AJ-003",
        partnerType: "CONSULTANT",
        name: "Siddharth Sharma",
        companyName: "Retail Growth Consultancies",
        mobile: "9933445566",
        email: "siddharth@growth.com",
        address: "C-Scheme, Jaipur",
        gstNumber: "",
        status: "ACTIVE",
        joinedDate: addDays(today, -30),
        remarks: "Helps stores digitize operations",
        createdAt: addDays(today, -30),
        updatedAt: addDays(today, -30)
      },
      {
        _id: p4,
        tenantId: "default-shop",
        partnerCode: "PART-AJ-004",
        partnerType: "REFERRAL_PARTNER",
        name: "Rohan Gupta",
        companyName: "Gupta & Sons",
        mobile: "9944556677",
        email: "rohan@gupta.com",
        address: "Chandni Chowk, Delhi",
        gstNumber: "",
        status: "INACTIVE",
        joinedDate: addDays(today, -10),
        remarks: "Temporarily inactive partner",
        createdAt: addDays(today, -10),
        updatedAt: addDays(today, -10)
      },
      {
        _id: p5,
        tenantId: "default-shop",
        partnerCode: "PART-AJ-005",
        partnerType: "AGENT",
        name: "Prakash Mehta",
        companyName: "Mehta Consulting Co.",
        mobile: "9955667788",
        email: "prakash@mehta.com",
        address: "M.G. Road, Bengaluru",
        gstNumber: "29AABCV9012F3Z3",
        status: "BLOCKED",
        joinedDate: addDays(today, -100),
        remarks: "Blocked due to policy violations",
        createdAt: addDays(today, -100),
        updatedAt: addDays(today, -15)
      }
    ];
    await partnersCol.insertMany(mockPartners);
    console.log("Seeded 5 ReferralPartners");
    
    // ----------------------------------------------------
    // 4. Seed Referral Leads (5 records)
    // ----------------------------------------------------
    const leadsCol = db.collection("referralleads");
    await leadsCol.deleteMany({});
    
    const l1 = new ObjectId();
    const l2 = new ObjectId();
    const l3 = new ObjectId();
    const l4 = new ObjectId();
    const l5 = new ObjectId();
    
    const mockLeads = [
      {
        _id: l1,
        tenantId: "default-shop",
        referralPartnerId: p1,
        referredStoreName: "Gitanjali Diamonds Store",
        ownerName: "Alok Gupta",
        mobile: "8811223344",
        email: "alok@gitanjali.com",
        source: "Partner Referral",
        status: "CONVERTED",
        convertedTenantId: "shop-converted-001",
        conversionDate: addDays(today, -10),
        remarks: "Onboarded for B2B portal system",
        createdAt: addDays(today, -20),
        updatedAt: addDays(today, -10)
      },
      {
        _id: l2,
        tenantId: "default-shop",
        referralPartnerId: p1,
        referredStoreName: "Rajputana Heritage Jewelry",
        ownerName: "Vikram Singh",
        mobile: "8822334455",
        email: "vikram@rajputana.com",
        source: "Partner Referral",
        status: "NEGOTIATION",
        convertedTenantId: null,
        conversionDate: null,
        remarks: "Draft contract sent, awaiting signature",
        createdAt: addDays(today, -15),
        updatedAt: today
      },
      {
        _id: l3,
        tenantId: "default-shop",
        referralPartnerId: p2,
        referredStoreName: "Tanishq Sub-Dealer Indore",
        ownerName: "Harish Goyal",
        mobile: "8833445566",
        email: "harish@indoredoc.com",
        source: "Broker Network",
        status: "DEMO_SCHEDULED",
        convertedTenantId: null,
        conversionDate: null,
        remarks: "Demo scheduled for Wednesday 4 PM",
        createdAt: addDays(today, -5),
        updatedAt: today
      },
      {
        _id: l4,
        tenantId: "default-shop",
        referralPartnerId: p3,
        referredStoreName: "Kalyan Jewellers franchisee",
        ownerName: "Sunil Kalyan",
        mobile: "8844556677",
        email: "sunil@kalyanfranchise.com",
        source: "Direct Consult",
        status: "CONTACTED",
        convertedTenantId: null,
        conversionDate: null,
        remarks: "Initial interest shown, presentation sent",
        createdAt: addDays(today, -2),
        updatedAt: today
      },
      {
        _id: l5,
        tenantId: "default-shop",
        referralPartnerId: p2,
        referredStoreName: "Nisha Silver House",
        ownerName: "Nisha Shah",
        mobile: "8855667788",
        email: "nisha@silverhouse.com",
        source: "Broker Network",
        status: "LOST",
        convertedTenantId: null,
        conversionDate: null,
        remarks: "Found solution too expensive, lost lead",
        createdAt: addDays(today, -30),
        updatedAt: addDays(today, -15)
      }
    ];
    await leadsCol.insertMany(mockLeads);
    console.log("Seeded 5 ReferralLeads");
    
    // ----------------------------------------------------
    // 5. Seed Referral Commissions (5 records)
    // ----------------------------------------------------
    const commCol = db.collection("referralcommissions");
    await commCol.deleteMany({});
    
    const com1 = new ObjectId();
    const com2 = new ObjectId();
    const com3 = new ObjectId();
    const com4 = new ObjectId();
    const com5 = new ObjectId();
    
    const mockCommissions = [
      {
        _id: com1,
        tenantId: "default-shop",
        referralId: l1,
        referralPartnerId: p1,
        commissionType: "PERCENTAGE",
        commissionValue: 10,
        commissionAmount: 5000,
        subscriptionAmount: 50000,
        status: "PAID",
        calculatedAt: addDays(today, -10),
        remarks: "Filing referral reward paid out",
        createdAt: addDays(today, -10),
        updatedAt: addDays(today, -5)
      },
      {
        _id: com2,
        tenantId: "default-shop",
        referralId: l2,
        referralPartnerId: p1,
        commissionType: "FIXED",
        commissionValue: 10000,
        commissionAmount: 10000,
        subscriptionAmount: 120000,
        status: "APPROVED",
        calculatedAt: addDays(today, -1),
        remarks: "Approved - pending final bank transfer",
        createdAt: addDays(today, -1),
        updatedAt: today
      },
      {
        _id: com3,
        tenantId: "default-shop",
        referralId: l3,
        referralPartnerId: p2,
        commissionType: "FIXED",
        commissionValue: 3500,
        commissionAmount: 3500,
        subscriptionAmount: 30000,
        status: "PENDING",
        calculatedAt: today,
        remarks: "Review pending on demo completion feedback",
        createdAt: today,
        updatedAt: today
      },
      {
        _id: com4,
        tenantId: "default-shop",
        referralId: l4,
        referralPartnerId: p3,
        commissionType: "PERCENTAGE",
        commissionValue: 15,
        commissionAmount: 6000,
        subscriptionAmount: 40000,
        status: "PENDING",
        calculatedAt: today,
        remarks: "Draft calculations - pending conversion status update",
        createdAt: today,
        updatedAt: today
      },
      {
        _id: com5,
        tenantId: "default-shop",
        referralId: l5,
        referralPartnerId: p2,
        commissionType: "FIXED",
        commissionValue: 2000,
        commissionAmount: 2000,
        subscriptionAmount: 0,
        status: "CANCELLED",
        remarks: "Cancelled as lead became Lost state",
        createdAt: addDays(today, -15),
        updatedAt: addDays(today, -15)
      }
    ];
    await commCol.insertMany(mockCommissions);
    console.log("Seeded 5 ReferralCommissions");
    
    // ----------------------------------------------------
    // 6. Seed Referral Payout Ledger (5 records)
    // ----------------------------------------------------
    const payoutCol = db.collection("referralpayoutledgers");
    await payoutCol.deleteMany({});
    
    const mockPayouts = [
      {
        tenantId: "default-shop",
        referralPartnerId: p1,
        commissionId: com1,
        earnedAmount: 5000,
        paidAmount: 5000,
        pendingAmount: 0,
        paymentDate: addDays(today, -5),
        paymentMethod: "UPI Transfer",
        referenceNumber: "UPI878239012893",
        status: "PAID",
        remarks: "Paid in full via phonepe",
        createdAt: addDays(today, -5),
        updatedAt: addDays(today, -5)
      },
      {
        tenantId: "default-shop",
        referralPartnerId: p1,
        commissionId: com2,
        earnedAmount: 10000,
        paidAmount: 4000,
        pendingAmount: 6000,
        paymentDate: today,
        paymentMethod: "NEFT Transfer",
        referenceNumber: "NFT23091002",
        status: "PARTIALLY_PAID",
        remarks: "Partial first payout milestone check",
        createdAt: today,
        updatedAt: today
      },
      {
        tenantId: "default-shop",
        referralPartnerId: p2,
        commissionId: com3,
        earnedAmount: 3500,
        paidAmount: 0,
        pendingAmount: 3500,
        paymentDate: null,
        paymentMethod: "",
        referenceNumber: "",
        status: "EARNED",
        remarks: "Commission logged, awaiting approval",
        createdAt: today,
        updatedAt: today
      },
      {
        tenantId: "default-shop",
        referralPartnerId: p3,
        commissionId: com4,
        earnedAmount: 6000,
        paidAmount: 0,
        pendingAmount: 6000,
        paymentDate: null,
        paymentMethod: "",
        referenceNumber: "",
        status: "EARNED",
        remarks: "Draft ledger logs, awaiting confirmation",
        createdAt: today,
        updatedAt: today
      },
      {
        tenantId: "default-shop",
        referralPartnerId: p2,
        commissionId: com5,
        earnedAmount: 2000,
        paidAmount: 0,
        pendingAmount: 2000,
        paymentDate: null,
        paymentMethod: "",
        referenceNumber: "",
        status: "CANCELLED",
        remarks: "Cancelled ledger record entry",
        createdAt: addDays(today, -15),
        updatedAt: addDays(today, -15)
      }
    ];
    await payoutCol.insertMany(mockPayouts);
    console.log("Seeded 5 ReferralPayoutLedger items");
    
    // ----------------------------------------------------
    // 7. Seed Price Resolution Logs (5 records)
    // ----------------------------------------------------
    const logsCol = db.collection("priceresolutionlogs");
    await logsCol.deleteMany({});
    
    const mockLogs = [
      {
        tenantId: "default-shop",
        vendorId: v1_id,
        metalType: "GOLD",
        purity: "22K",
        transactionDate: addDays(today, -2),
        resolvedRate: 6500,
        source: "CONTRACT_RULE",
        contractId: c1,
        ruleId: r1,
        remarks: "Calculated based on active Gold Contract #CON-2026-001 rule #1",
        createdAt: addDays(today, -2),
        updatedAt: addDays(today, -2)
      },
      {
        tenantId: "default-shop",
        vendorId: v1_id,
        metalType: "SILVER",
        purity: "92.5",
        transactionDate: addDays(today, -1),
        resolvedRate: 685,
        source: "CONTRACT_RULE",
        contractId: c2,
        ruleId: r3,
        remarks: "Calculated based on active Silver Contract #CON-2026-002 offset (-200/gm) from live rates",
        createdAt: addDays(today, -1),
        updatedAt: addDays(today, -1)
      },
      {
        tenantId: "default-shop",
        vendorId: v2_id,
        metalType: "GOLD",
        purity: "18K",
        transactionDate: today,
        resolvedRate: 5400,
        source: "PURCHASE_PRICE",
        contractId: null,
        ruleId: null,
        remarks: "No active rate rule. Calculated from average of last 3 gold purchases history.",
        createdAt: today,
        updatedAt: today
      },
      {
        tenantId: "default-shop",
        vendorId: v2_id,
        metalType: "PLATINUM",
        purity: "950",
        transactionDate: today,
        resolvedRate: 4800,
        source: "DEFAULT_RATE",
        contractId: null,
        ruleId: null,
        remarks: "Fallback: Contract expired and no purchase history. Defaulted to system live platinum rate.",
        createdAt: today,
        updatedAt: today
      },
      {
        tenantId: "default-shop",
        vendorId: v1_id,
        metalType: "GOLD",
        purity: "24K",
        transactionDate: addDays(today, -10),
        resolvedRate: 7200,
        source: "DEFAULT_RATE",
        contractId: null,
        ruleId: null,
        remarks: "Gold rate fallback: live rate loaded directly.",
        createdAt: addDays(today, -10),
        updatedAt: addDays(today, -10)
      }
    ];
    await logsCol.insertMany(mockLogs);
    console.log("Seeded 5 PriceResolutionLogs");
    
    // ----------------------------------------------------
    // 8. Seed branding & theme (1 record each)
    // ----------------------------------------------------
    const themeCol = db.collection("tenantthemes");
    await themeCol.deleteMany({});
    await themeCol.insertOne({
      tenantId: "default-shop",
      primaryColor: "#B89D42", // Elegant Gold
      secondaryColor: "#1A2530", // Sleek Blue/Black
      accentColor: "#DDA0DD",
      loginBannerUrl: "/uploads/general/login_banner.png",
      loginBackgroundUrl: "/uploads/general/login_bg.jpg",
      createdAt: today,
      updatedAt: today
    });
    
    const domainCol = db.collection("tenantdomains");
    await domainCol.deleteMany({});
    await domainCol.insertMany([
      {
        tenantId: "default-shop",
        domain: "shop.aurajewel.com",
        status: "VERIFIED",
        dnsType: "CNAME",
        dnsValue: "domains.aurajewel.com",
        sslStatus: "ACTIVE",
        sslExpiresAt: addDays(today, 90),
        createdAt: today,
        updatedAt: today
      },
      {
        tenantId: "default-shop",
        domain: "shop2.aurajewel.com",
        status: "PENDING",
        dnsType: "TXT",
        dnsValue: "aurajewel-challenge-tok-1234",
        sslStatus: "NONE",
        sslExpiresAt: null,
        createdAt: today,
        updatedAt: today
      }
    ]);
    
    const appSettingsCol = db.collection("tenantappsettings");
    await appSettingsCol.deleteMany({});
    await appSettingsCol.insertOne({
      tenantId: "default-shop",
      appName: "Indore Gold Gallery",
      shortName: "AuraIndore",
      appIconUrl: "/uploads/general/app_icon.png",
      splashImageUrl: "/uploads/general/splash.png",
      pwaEnabled: true,
      createdAt: today,
      updatedAt: today
    });
    console.log("Seeded default custom domains, branding themes, PWA settings.");
    
    // ----------------------------------------------------
    // 9. Sync TenantDomain mapping to super admin collection if exists
    // ----------------------------------------------------
    const superDomainsCol = superAdminDb.collection("tenantdomains");
    try {
      await superDomainsCol.deleteMany({ tenantId: "default-shop" });
      await superDomainsCol.insertOne({
        tenantId: "default-shop",
        domain: "shop.aurajewel.com",
        status: "VERIFIED",
        createdAt: today,
        updatedAt: today
      });
      console.log("Synced domains list to super admin mapping directory");
    } catch (err) {
      console.log("Super admin DB sync skipped or not connected");
    }

  } finally {
    await client.close();
    console.log("Database connection closed");
  }
}

seed().catch(console.error);
