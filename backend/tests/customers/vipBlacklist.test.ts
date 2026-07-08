import { describe, it, expect } from "@jest/globals";
import mongoose from "mongoose";
import { Customer } from "../../retailer/models/index.js";
import {
  markCustomerVip,
  removeCustomerVip,
  blacklistCustomer,
  removeCustomerBlacklist,
  getVipCustomers,
  getBlacklistedCustomers,
  getCustomerTierSummary,
} from "../../retailer/controllers/customers/customersController.js";

// ─── Mock Helpers ─────────────────────────────────────────────────────────────

function mockRes() {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
}

function adminReq(params: any = {}, body: any = {}): any {
  return {
    params,
    body,
    user: { id: "admin_001", email: "admin@aurajewel.com", role: "ADMIN" },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    headers: {},
    query: {},
  };
}

function salesReq(params: any = {}, body: any = {}): any {
  return {
    params,
    body,
    user: { id: "sales_001", email: "sales@aurajewel.com", role: "SALES_STAFF" },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    headers: {},
    query: {},
  };
}

async function createCustomer(overrides: any = {}) {
  const customer = await Customer.create({
    name: overrides.name || "Test Customer",
    phone: overrides.phone || `99${Date.now().toString().slice(-8)}`,
    email: overrides.email || `test_${Date.now()}@example.com`,
    customerTier: overrides.customerTier || "NORMAL",
    tags: overrides.tags || ["NORMAL"],
    ...overrides,
  });
  return customer;
}

// ─── VIP Management Tests ────────────────────────────────────────────────────

describe("VIP / Blacklist Management – Feature 11", () => {
  // ── VIP Assignment ──────────────────────────────────────────────────────────
  describe("VIP Assignment", () => {
    it("marks a NORMAL customer as VIP successfully", async () => {
      const customer = await createCustomer();
      const id = customer._id.toString();

      const res = mockRes();
      await markCustomerVip(adminReq({ id }, { note: "High spender" }), res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.customerTier).toBe("VIP");
      expect(res.body.data.tags).toContain("VIP");

      const updated = await Customer.findById(id).lean();
      expect(updated.customerTier).toBe("VIP");
      expect(updated.vipSince).toBeDefined();
    });

    it("returns 404 if customer does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = mockRes();
      await markCustomerVip(adminReq({ id: fakeId }, {}), res);
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("Customer not found");
    });

    it("prevents duplicate VIP assignment", async () => {
      const customer = await createCustomer({ customerTier: "VIP", tags: ["VIP"] });
      const id = customer._id.toString();

      const res = mockRes();
      await markCustomerVip(adminReq({ id }, {}), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("already a VIP");
    });

    it("prevents marking BLACKLISTED customer as VIP", async () => {
      const customer = await createCustomer({ customerTier: "BLACKLISTED", tags: ["BLACKLISTED"] });
      const id = customer._id.toString();

      const res = mockRes();
      await markCustomerVip(adminReq({ id }, {}), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Blacklisted customers cannot be marked as VIP");
    });
  });

  // ── VIP Removal ─────────────────────────────────────────────────────────────
  describe("VIP Removal", () => {
    it("removes VIP status and reverts to NORMAL", async () => {
      const customer = await createCustomer({ customerTier: "VIP", tags: ["VIP"], vipSince: new Date() });
      const id = customer._id.toString();

      const res = mockRes();
      await removeCustomerVip(adminReq({ id }, { note: "Removed due to inactivity" }), res);

      expect(res.body.success).toBe(true);
      expect(["NORMAL", "REGULAR"]).toContain(res.body.data.customerTier);
      expect(res.body.data.tags).not.toContain("VIP");
    });

    it("returns 400 when attempting to remove VIP from non-VIP customer", async () => {
      const customer = await createCustomer({ customerTier: "NORMAL", tags: ["NORMAL"] });
      const id = customer._id.toString();

      const res = mockRes();
      await removeCustomerVip(adminReq({ id }, {}), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("not a VIP");
    });
  });

  // ── Blacklist Customer ───────────────────────────────────────────────────────
  describe("Blacklist Customer", () => {
    it("blacklists a normal customer with a reason", async () => {
      const customer = await createCustomer();
      const id = customer._id.toString();

      const res = mockRes();
      await blacklistCustomer(adminReq({ id }, { reason: "Fraudulent transactions" }), res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.customerTier).toBe("BLACKLISTED");
      expect(res.body.data.blacklistReason).toBe("Fraudulent transactions");
      expect(res.body.data.tags).toContain("BLACKLISTED");

      const updated = await Customer.findById(id).lean();
      expect(updated.customerTier).toBe("BLACKLISTED");
      expect(updated.blacklistDate).toBeDefined();
      expect(updated.blacklistedBy).toBeTruthy();
    });

    it("prevents duplicate blacklisting", async () => {
      const customer = await createCustomer({ customerTier: "BLACKLISTED", tags: ["BLACKLISTED"] });
      const id = customer._id.toString();

      const res = mockRes();
      await blacklistCustomer(adminReq({ id }, { reason: "Repeat offence" }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("already blacklisted");
    });

    it("removes VIP tag when blacklisting a VIP customer", async () => {
      const customer = await createCustomer({ customerTier: "VIP", tags: ["VIP"] });
      const id = customer._id.toString();

      const res = mockRes();
      await blacklistCustomer(adminReq({ id }, { reason: "Policy violation" }), res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.customerTier).toBe("BLACKLISTED");
      expect(res.body.data.tags).toContain("BLACKLISTED");
      expect(res.body.data.tags).not.toContain("VIP");
    });

    it("returns 404 if customer does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = mockRes();
      await blacklistCustomer(adminReq({ id: fakeId }, { reason: "Test" }), res);
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Remove From Blacklist ────────────────────────────────────────────────────
  describe("Remove From Blacklist", () => {
    it("removes a customer from the blacklist", async () => {
      const customer = await createCustomer({
        customerTier: "BLACKLISTED",
        tags: ["BLACKLISTED"],
        blacklistReason: "Fraud",
        blacklistDate: new Date(),
        blacklistedBy: "admin@test.com",
      });
      const id = customer._id.toString();

      const res = mockRes();
      await removeCustomerBlacklist(adminReq({ id }, { reason: "Issue resolved" }), res);

      expect(res.body.success).toBe(true);
      expect(["NORMAL", "REGULAR"]).toContain(res.body.data.customerTier);
      expect(res.body.data.tags).not.toContain("BLACKLISTED");

      const updated = await Customer.findById(id).lean();
      expect(updated.blacklistReason).toBeFalsy();
    });

    it("returns 400 when removing blacklist from non-blacklisted customer", async () => {
      const customer = await createCustomer({ customerTier: "NORMAL", tags: ["NORMAL"] });
      const id = customer._id.toString();

      const res = mockRes();
      await removeCustomerBlacklist(adminReq({ id }, { reason: "Cleanup" }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("not blacklisted");
    });
  });

  // ── Listing Endpoints ────────────────────────────────────────────────────────
  describe("Listing APIs", () => {
    it("getVipCustomers returns only VIP customers", async () => {
      await createCustomer({ name: "VIP A", customerTier: "VIP", tags: ["VIP"] });
      await createCustomer({ name: "VIP B", customerTier: "VIP", tags: ["VIP"] });
      await createCustomer({ name: "Normal C", customerTier: "NORMAL", tags: ["NORMAL"] });

      const res = mockRes();
      await getVipCustomers(adminReq(), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.every((c: any) => c.customerTier === "VIP")).toBe(true);
    });

    it("getBlacklistedCustomers returns only BLACKLISTED customers", async () => {
      await createCustomer({ name: "Blacklisted X", customerTier: "BLACKLISTED", tags: ["BLACKLISTED"] });
      await createCustomer({ name: "Normal Y", customerTier: "NORMAL", tags: ["NORMAL"] });

      const res = mockRes();
      await getBlacklistedCustomers(adminReq(), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].customerTier).toBe("BLACKLISTED");
    });

    it("getCustomerTierSummary returns accurate counts", async () => {
      await createCustomer({ customerTier: "VIP", tags: ["VIP"] });
      await createCustomer({ customerTier: "VIP", tags: ["VIP"] });
      await createCustomer({ customerTier: "BLACKLISTED", tags: ["BLACKLISTED"] });
      await createCustomer({ customerTier: "NORMAL", tags: ["NORMAL"] });

      const res = mockRes();
      await getCustomerTierSummary(adminReq(), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.vipCount).toBe(2);
      expect(res.body.data.summary.blacklistedCount).toBe(1);
    });
  });

  // ── Audit Log Integration ────────────────────────────────────────────────────
  describe("Audit Log Integration", () => {
    it("writes a FinanceAuditLog entry when marking a customer VIP", async () => {
      const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
      const FinanceAuditLog = retailerConn.models.FinanceAuditLog;

      const customer = await createCustomer();
      const id = customer._id.toString();

      const res = mockRes();
      await markCustomerVip(adminReq({ id }, { note: "Top spender" }), res);
      expect(res.body.success).toBe(true);

      const log = await FinanceAuditLog.findOne({
        actionType: "CUSTOMER_MARKED_VIP",
        entityId: id,
      });
      expect(log).not.toBeNull();
      expect(log.entityType).toBe("CUSTOMER");
    });

    it("writes a FinanceAuditLog entry when blacklisting a customer", async () => {
      const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
      const FinanceAuditLog = retailerConn.models.FinanceAuditLog;

      const customer = await createCustomer();
      const id = customer._id.toString();

      const res = mockRes();
      await blacklistCustomer(adminReq({ id }, { reason: "Audit test" }), res);
      expect(res.body.success).toBe(true);

      const log = await FinanceAuditLog.findOne({
        actionType: "CUSTOMER_BLACKLISTED",
        entityId: id,
      });
      expect(log).not.toBeNull();
      expect(log.entityType).toBe("CUSTOMER");
    });
  });

  // ── Notification Integration ─────────────────────────────────────────────────
  describe("Notification Integration", () => {
    it("creates a CUSTOMER_MARKED_VIP notification", async () => {
      const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
      const Notification = retailerConn.models.Notification;

      const customer = await createCustomer({ name: "Notif VIP Test" });
      const id = customer._id.toString();

      const res = mockRes();
      await markCustomerVip(adminReq({ id }, {}), res);
      expect(res.body.success).toBe(true);

      const notif = await Notification.findOne({ type: "CUSTOMER_MARKED_VIP", relatedEntityId: id });
      expect(notif).not.toBeNull();
      expect(notif.category).toBe("Customer");
    });

    it("creates a CUSTOMER_BLACKLISTED notification", async () => {
      const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
      const Notification = retailerConn.models.Notification;

      const customer = await createCustomer({ name: "Notif Blacklist Test" });
      const id = customer._id.toString();

      const res = mockRes();
      await blacklistCustomer(adminReq({ id }, { reason: "Notification test" }), res);
      expect(res.body.success).toBe(true);

      const notif = await Notification.findOne({ type: "CUSTOMER_BLACKLISTED", relatedEntityId: id });
      expect(notif).not.toBeNull();
    });

    it("creates a CUSTOMER_REMOVED_BLACKLIST notification", async () => {
      const retailerConn = mongoose.connection.useDb("retailer", { useCache: true });
      const Notification = retailerConn.models.Notification;

      const customer = await createCustomer({
        customerTier: "BLACKLISTED",
        tags: ["BLACKLISTED"],
        blacklistReason: "Test",
        blacklistDate: new Date(),
      });
      const id = customer._id.toString();

      const res = mockRes();
      await removeCustomerBlacklist(adminReq({ id }, { reason: "Resolved" }), res);
      expect(res.body.success).toBe(true);

      const notif = await Notification.findOne({ type: "CUSTOMER_REMOVED_BLACKLIST", relatedEntityId: id });
      expect(notif).not.toBeNull();
    });
  });
});
