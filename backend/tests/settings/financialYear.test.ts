import mongoose from "mongoose";
import { FinancialYear, Invoice } from "../../retailer/models/index.js";
import { getCurrentFinancialYear, getNextInvoiceNumber } from "../../retailer/services/invoice/invoiceNumberService.js";

describe("Financial Year Management Unit Tests", () => {
  beforeEach(async () => {
    if (mongoose.connection.useDb("retailer").models.FinancialYear) {
      await FinancialYear.deleteMany({});
    }
  });

  test("Financial Year Creation and Validation", async () => {
    const fy = await FinancialYear.create({
      name: "FY 2026-27",
      code: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "UPCOMING",
      isDefault: false,
      remarks: "Upcoming target period"
    });

    expect(fy.name).toBe("FY 2026-27");
    expect(fy.code).toBe("2026-27");
    expect(fy.status).toBe("UPCOMING");
  });

  test("Only One Active Financial Year and Automatic Lookup", async () => {
    // 1. Create and Activate 2026-27
    const fy1 = await FinancialYear.create({
      name: "FY 2026-27",
      code: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
      isDefault: true,
    });

    const activeCode1 = await getCurrentFinancialYear();
    expect(activeCode1).toBe("2026-27");

    // 2. Create another one. When activating, deactivate previous.
    const fy2 = await FinancialYear.create({
      name: "FY 2027-28",
      code: "2027-28",
      startDate: new Date("2027-04-01"),
      endDate: new Date("2028-03-31"),
      status: "UPCOMING",
      isDefault: false,
    });

    // Emulate activation logic from controller:
    await FinancialYear.updateMany({ status: "ACTIVE" }, { $set: { status: "CLOSED", isDefault: false } });
    fy2.status = "ACTIVE";
    fy2.isDefault = true;
    await fy2.save();

    const activeCode2 = await getCurrentFinancialYear();
    expect(activeCode2).toBe("2027-28");

    // Check count of active years
    const activeCount = await FinancialYear.countDocuments({ status: "ACTIVE" });
    expect(activeCount).toBe(1);
  });

  test("Invoice Integration: Format prefix/fy/sequence", async () => {
    await FinancialYear.create({
      name: "FY 2026-27",
      code: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
      isDefault: true,
    });

    const invoiceNum = await getNextInvoiceNumber("test-shop", "AJ");
    expect(invoiceNum).toBe("AJ/2026-27/000001");
  });
});
