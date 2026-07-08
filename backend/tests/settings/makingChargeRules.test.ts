import request from "supertest";
import mongoose from "mongoose";
import app from "../../../backend/server.ts"; // Or just require standard test setup
import { MakingChargeRule } from "../../retailer/models/index.js";
import { resolveMakingCharge } from "../../lib/chargeEngine.js";

describe("Making Charge Rules Engine Integration Tests", () => {
  beforeEach(async () => {
    if (mongoose.connection.useDb("retailer").models.MakingChargeRule) {
      await MakingChargeRule.deleteMany({});
    }
  });

  test("Rule Creation and DB Persistence", async () => {
    const rule = await MakingChargeRule.create({
      ruleId: "TEST-RULE-1",
      ruleName: "Gold Per Gram Promo",
      ruleType: "GLOBAL",
      metalType: "GOLD",
      calculationMethod: "PER_GRAM",
      value: 120,
      priority: 50,
      isActive: true,
      createdBy: "test-admin"
    });
    expect(rule.ruleId).toBe("TEST-RULE-1");
    expect(rule.value).toBe(120);

    const found = await MakingChargeRule.findOne({ ruleId: "TEST-RULE-1" });
    expect(found).not.toBeNull();
  });

  test("Priority Resolution: PRODUCT > GLOBAL", async () => {
    // 1. Create Global Rule (₹100/g)
    await MakingChargeRule.create({
      ruleId: "GLOBAL-GOLD",
      ruleName: "Gold Global",
      ruleType: "GLOBAL",
      metalType: "GOLD",
      calculationMethod: "PER_GRAM",
      value: 100,
      priority: 100,
      isActive: true,
      createdBy: "test-admin"
    });

    // 2. Create Product-specific Rule (₹250/g)
    await MakingChargeRule.create({
      ruleId: "PROD-RING-01",
      ruleName: "Exclusive Gold Ring Promo",
      ruleType: "PRODUCT",
      metalType: "GOLD",
      productId: "SKU-RING-01",
      calculationMethod: "PER_GRAM",
      value: 250,
      priority: 10,
      isActive: true,
      createdBy: "test-admin"
    });

    // Resolve for general gold item
    const generalRes = await resolveMakingCharge({
      metalType: "GOLD",
      weight: 10,
      productValue: 50000
    });
    expect(generalRes.chargeAmount).toBe(10 * 100); // 1000

    // Resolve for SKU-RING-01
    const productRes = await resolveMakingCharge({
      metalType: "GOLD",
      productId: "SKU-RING-01",
      weight: 10,
      productValue: 50000
    });
    expect(productRes.chargeAmount).toBe(10 * 250); // 2500
    expect(productRes.appliedRule.ruleId).toBe("PROD-RING-01");
  });

  test("PER_GRAM Calculation Method", async () => {
    await MakingChargeRule.create({
      ruleId: "PER-GRAM-RULE",
      ruleName: "Per Gram",
      ruleType: "GLOBAL",
      metalType: "GOLD",
      calculationMethod: "PER_GRAM",
      value: 150,
      isActive: true,
      createdBy: "test-admin"
    });

    const res = await resolveMakingCharge({ metalType: "GOLD", weight: 8.5 });
    expect(res.chargeAmount).toBe(Math.round(8.5 * 150));
  });

  test("FIXED Calculation Method with min/max constraints", async () => {
    await MakingChargeRule.create({
      ruleId: "FIXED-RULE",
      ruleName: "Fixed Surcharge",
      ruleType: "GLOBAL",
      metalType: "SILVER",
      calculationMethod: "FIXED",
      value: 600,
      minValue: 700, // force minimum
      isActive: true,
      createdBy: "test-admin"
    });

    const res = await resolveMakingCharge({ metalType: "SILVER" });
    expect(res.chargeAmount).toBe(700); // values below 700 constraint raise to 700
  });

  test("PERCENTAGE Calculation Method", async () => {
    await MakingChargeRule.create({
      ruleId: "PERCENT-RULE",
      ruleName: "Ten Percent Rule",
      ruleType: "GLOBAL",
      metalType: "PLATINUM",
      calculationMethod: "PERCENTAGE",
      value: 10,
      isActive: true,
      createdBy: "test-admin"
    });

    const res = await resolveMakingCharge({ metalType: "PLATINUM", productValue: 30000 });
    expect(res.chargeAmount).toBe(3000);
  });

  test("PER_PIECE Calculation Method", async () => {
    await MakingChargeRule.create({
      ruleId: "PIECE-RULE",
      ruleName: "Per Piece Rule",
      ruleType: "GLOBAL",
      metalType: "DIAMOND",
      calculationMethod: "PER_PIECE",
      value: 500,
      isActive: true,
      createdBy: "test-admin"
    });

    const res = await resolveMakingCharge({ metalType: "DIAMOND", quantity: 3 });
    expect(res.chargeAmount).toBe(1500);
  });
});
