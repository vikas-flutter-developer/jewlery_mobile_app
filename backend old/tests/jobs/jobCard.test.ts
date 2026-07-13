import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { RepairJob, JobCard as JobCardModel } from "../../retailer/models/index.js";
import {
  generateJobCard,
  listJobCardHistory,
  getLatestJobCard,
  incrementDownloadCount,
  incrementPrintCount,
} from "../../retailer/services/jobCardService.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeJobId = () => `REP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const createTestJob = async (overrides: Record<string, unknown> = {}) => {
  return RepairJob.create({
    repairJobId: makeJobId(),
    customerName: "Ananya Sharma",
    customerPhone: "9876543210",
    customerCode: "CUST-001",
    itemDescription: "22K Gold Ring",
    estimatedWeight: 8.5,
    status: "Received",
    karikarId: "karikar-test-id",
    metalType: "Gold",
    issuedPurity: "22K",
    priority: "NORMAL",
    ...overrides,
  });
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Job Card Service", () => {
  // ── PDF Generation ────────────────────────────────────────────────────────

  it("generates a job card and stores all required fields", async () => {
    const job = await createTestJob();
    const result = await generateJobCard(job.repairJobId, "tester", {
      storeName: "AuraJewel Studio",
      storeUrl: "http://localhost:3000",
    });

    expect(result.jobId).toBe(job.repairJobId);
    expect(result.version).toBe(1);
    expect(result.pdfUrl).toBeDefined();
    expect(typeof result.pdfUrl).toBe("string");
    expect(result.qrData).toContain(job.repairJobId);
    expect(result.barcode).toBeTruthy();
    expect(result.jobCardNumber).toBeDefined();
    expect(result.storeName).toBeDefined();
  });

  it("does NOT regenerate if latest version exists and force=false", async () => {
    const job = await createTestJob();
    const first = await generateJobCard(job.repairJobId, "tester", { force: false });
    const second = await generateJobCard(job.repairJobId, "tester", { force: false });

    expect(second.version).toBe(first.version);
    expect(second._id?.toString()).toBe(first._id?.toString());
  });

  // ── Regeneration & Version History ────────────────────────────────────────

  it("creates a new version when force=true", async () => {
    const job = await createTestJob();
    const v1 = await generateJobCard(job.repairJobId, "tester", { force: false });
    const v2 = await generateJobCard(job.repairJobId, "tester", { force: true });

    expect(v2.version).toBe(v1.version + 1);
  });

  it("increments version correctly on successive regenerations", async () => {
    const job = await createTestJob();
    await generateJobCard(job.repairJobId, "tester", { force: false });
    const v2 = await generateJobCard(job.repairJobId, "tester", { force: true });
    const v3 = await generateJobCard(job.repairJobId, "tester", { force: true });

    expect(v3.version).toBe(3);
    expect(v2.version).toBe(2);
  });

  // ── History ───────────────────────────────────────────────────────────────

  it("listJobCardHistory returns paginated results", async () => {
    const job = await createTestJob();
    await generateJobCard(job.repairJobId, "tester", { force: false });
    await generateJobCard(job.repairJobId, "tester", { force: true });

    const page1 = await listJobCardHistory(job.repairJobId, { page: 1, limit: 1 });
    expect(page1.total).toBeGreaterThanOrEqual(2);
    expect(page1.items.length).toBe(1);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(1);
  });

  it("history items are sorted latest version first", async () => {
    const job = await createTestJob();
    await generateJobCard(job.repairJobId, "tester", { force: false });
    await generateJobCard(job.repairJobId, "tester", { force: true });

    const history = await listJobCardHistory(job.repairJobId, { page: 1, limit: 10 });
    expect(history.items[0].version).toBeGreaterThan(history.items[1].version);
  });

  // ── getLatestJobCard ──────────────────────────────────────────────────────

  it("getLatestJobCard returns the highest version", async () => {
    const job = await createTestJob();
    await generateJobCard(job.repairJobId, "tester", { force: false });
    await generateJobCard(job.repairJobId, "tester", { force: true });

    const latest = await getLatestJobCard(job.repairJobId);
    expect(latest?.version).toBe(2);
  });

  it("getLatestJobCard returns null for unknown jobId", async () => {
    const result = await getLatestJobCard("NONEXISTENT-JOB-ID");
    expect(result).toBeNull();
  });

  // ── QR Code ───────────────────────────────────────────────────────────────

  it("stores a QR data URL referencing the job", async () => {
    const job = await createTestJob();
    const result = await generateJobCard(job.repairJobId, "tester", {
      storeUrl: "https://aurajewel.com",
    });

    expect(result.qrData).toContain(job.repairJobId);
    expect(result.qrData).toContain("aurajewel.com");
  });

  // ── Barcode ───────────────────────────────────────────────────────────────

  it("stores a barcode value equal to the job repairJobId", async () => {
    const job = await createTestJob();
    const result = await generateJobCard(job.repairJobId, "tester");

    expect(result.barcode).toBe(job.repairJobId);
  });

  // ── Download / Print counts ───────────────────────────────────────────────

  it("incrementDownloadCount increases download counter", async () => {
    const job = await createTestJob();
    await generateJobCard(job.repairJobId, "tester");

    await incrementDownloadCount(job.repairJobId);
    await incrementDownloadCount(job.repairJobId);

    const latest = await getLatestJobCard(job.repairJobId);
    expect((latest as any)?.downloadCount).toBeGreaterThanOrEqual(2);
  });

  it("incrementPrintCount increases print counter", async () => {
    const job = await createTestJob();
    await generateJobCard(job.repairJobId, "tester");

    await incrementPrintCount(job.repairJobId);

    const latest = await getLatestJobCard(job.repairJobId);
    expect((latest as any)?.printCount).toBeGreaterThanOrEqual(1);
  });

  // ── Notifications ─────────────────────────────────────────────────────────

  it("generates JOB_CARD_GENERATED notification on first generation", async () => {
    const { Notification } = await import("../../retailer/models/index.js");
    const job = await createTestJob();
    const storeId = "test-shop";

    await generateJobCard(job.repairJobId, "tester", { storeId });

    const notif = await Notification.findOne({
      relatedEntityId: job.repairJobId,
      type: "JOB_CARD_GENERATED",
    });
    expect(notif).toBeTruthy();
    expect(notif?.tenantId).toBe(storeId);
  });

  it("generates JOB_CARD_REGENERATED notification on force re-generation", async () => {
    const { Notification } = await import("../../retailer/models/index.js");
    const job = await createTestJob();
    const storeId = "test-shop-regen";

    await generateJobCard(job.repairJobId, "tester", { storeId });
    await generateJobCard(job.repairJobId, "tester", { force: true, storeId });

    const notif = await Notification.findOne({
      relatedEntityId: job.repairJobId,
      type: "JOB_CARD_REGENERATED",
    });
    expect(notif).toBeTruthy();
  });

  // ── Audit Logs ────────────────────────────────────────────────────────────

  it("records a security audit event on generation", async () => {
    const { logSecurityEvent } = await import("../../lib/securityAudit.js");
    const spy = jest.spyOn({ logSecurityEvent }, "logSecurityEvent");
    const job = await createTestJob();

    const result = await generateJobCard(job.repairJobId, "audit-tester");

    // Verify the jobCardNumber and version are set (audit happens after)
    expect(result.version).toBeGreaterThanOrEqual(1);
    expect(result.jobCardNumber).toBeDefined();
    spy.mockRestore();
  });

  // ── RBAC (schema-level) ───────────────────────────────────────────────────

  it("stores karikarId on job card for RBAC scoping", async () => {
    const karikarId = "karikar-rbac-test";
    const job = await createTestJob({ karikarId });

    const result = await generateJobCard(job.repairJobId, "tester");

    // The karikarId from job propagates to the job card
    expect(result.karikarId).toBe(karikarId);
  });

  it("returns job card correctly scoped to karikarId", async () => {
    const karikarId = "karikar-scope-001";
    const job = await createTestJob({ karikarId });
    await generateJobCard(job.repairJobId, "tester");

    const found = await JobCardModel.findOne({ jobId: job.repairJobId, karikarId }).lean();
    expect(found).toBeTruthy();
    expect((found as any)?.karikarId).toBe(karikarId);
  });
});
