import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePrice } from "./retailer/services/vendors/contractPriceResolutionService.js";
import { getDbConnection, tenantLocalStorage } from "./lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const MONGODB_URI = process.env.MONGODB_URI || "";

async function testResolution() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is required");
    return;
  }
  
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to database for testing resolution");
  
  // Set tenant context
  tenantLocalStorage.run({ tenantId: "default-shop" }, async () => {
    try {
      const db = getDbConnection("retailer");
      const vendorsCol = db.collection("vendors");
      const vendors = await vendorsCol.find().limit(2).toArray();
      if (vendors.length === 0) {
        console.error("Please run database seed script first");
        return;
      }
      
      const v1 = vendors[0]._id.toString();
      const v2 = vendors[1]?._id.toString() || v1;
      
      console.log("\n--- Starting Price Resolution Engine Tests ---\n");
      
      // Test 1: Active contract gold fixed rule
      console.log("Test 1: Vendor 1 Gold 22K (Contracted rule FIXED_RATE ₹6,500)");
      const res1 = await resolvePrice({ vendorId: v1, metalType: "GOLD", purity: "22K" }, "default-shop");
      console.log(`Resolved Rate: ₹${res1.resolvedRate}/gm | Source: ${res1.source} | Contract: ${res1.contractId || 'None'} | Rule: ${res1.ruleId || 'None'}`);
      console.log(`Remarks: ${res1.remarks}\n`);
      
      // Test 2: Active contract gold market plus rule
      console.log("Test 2: Vendor 1 Gold 18K (Contracted rule MARKET_PLUS +₹150 offset)");
      const res2 = await resolvePrice({ vendorId: v1, metalType: "GOLD", purity: "18K" }, "default-shop");
      console.log(`Resolved Rate: ₹${res2.resolvedRate}/gm | Source: ${res2.source} | Contract: ${res2.contractId || 'None'} | Rule: ${res2.ruleId || 'None'}`);
      console.log(`Remarks: ${res2.remarks}\n`);

      // Test 3: Active contract silver market minus rule
      console.log("Test 3: Vendor 1 Silver 92.5 (Contracted rule MARKET_MINUS -₹200 offset)");
      const res3 = await resolvePrice({ vendorId: v1, metalType: "SILVER", purity: "92.5" }, "default-shop");
      console.log(`Resolved Rate: ₹${res3.resolvedRate}/gm | Source: ${res3.source} | Contract: ${res3.contractId || 'None'} | Rule: ${res3.ruleId || 'None'}`);
      console.log(`Remarks: ${res3.remarks}\n`);
      
      // Test 4: Fallback checks (No active contract or rule)
      console.log("Test 4: Vendor 2 Gold 18K (No rules, should trigger history fallback or default)");
      const res4 = await resolvePrice({ vendorId: v2, metalType: "GOLD", purity: "18K" }, "default-shop");
      console.log(`Resolved Rate: ₹${res4.resolvedRate}/gm | Source: ${res4.source} | Contract: ${res4.contractId || 'None'} | Rule: ${res4.ruleId || 'None'}`);
      console.log(`Remarks: ${res4.remarks}\n`);

      
      console.log("--- Price Resolution Tests Complete ---\n");
    } catch (err) {
      console.error("Resolution test failed with error:", err);
    } finally {
      await mongoose.connection.close();
      console.log("Database connection closed");
    }
  });
}

testResolution().catch(console.error);
