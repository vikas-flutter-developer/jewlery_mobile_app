import { Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import { FinancialYear, Notification, Sale, Invoice } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

// Fallback Mock Storage
let mockYears: any[] = [
  {
    _id: "fy_2026_27",
    name: "FY 2026-27",
    code: "2026-27",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2027-03-31"),
    status: "ACTIVE",
    isDefault: true,
    closedAt: null,
    closedBy: "",
    remarks: "Default active year"
  }
];

async function sendFYNotification(type: string, title: string, message: string) {
  try {
    if (isDbConnected()) {
      await Notification.create({
        notificationId: `NOTIF-FY-${Date.now()}`,
        type,
        title,
        message,
        category: "FinancialYear",
        severity: "INFO",
        channels: ["IN_APP"],
        sendAt: new Date(),
        status: "PENDING",
      });
    }
  } catch (err) {
    console.error("[FY Notification] Failed:", err);
  }
}

/**
 * POST /api/settings/financial-years
 */
export const createFinancialYear = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { name, code, startDate, endDate, remarks } = req.body;

    if (!name || !code || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    const newYear = {
      name,
      code,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "UPCOMING",
      isDefault: false,
      closedAt: null,
      closedBy: "",
      remarks: remarks || "",
    };

    if (isDbConnected()) {
      // Prevent duplicates
      const dup = await FinancialYear.findOne({ $or: [{ name }, { code }] });
      if (dup) {
        return res.status(400).json({ success: false, error: "Financial year name or code already exists." });
      }

      const created = await FinancialYear.create(newYear);
      await sendFYNotification("FY_CREATED", "Financial Year Created", `Financial year ${name} has been created.`);
      return res.status(201).json({ success: true, data: created });
    } else {
      mockYears.push(newYear);
      return res.status(201).json({ success: true, data: newYear });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to create financial year." });
  }
};

/**
 * PUT /api/settings/financial-years/:id
 */
export const updateFinancialYear = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;
    const { name, remarks } = req.body;

    if (isDbConnected()) {
      const year = await FinancialYear.findById(id);
      if (!year) return res.status(404).json({ success: false, error: "Financial Year not found." });

      if (year.status === "CLOSED") {
        return res.status(400).json({ success: false, error: "Cannot edit closed financial years." });
      }

      if (name) year.name = name;
      if (remarks) year.remarks = remarks;

      await year.save();
      return res.json({ success: true, data: year });
    } else {
      const idx = mockYears.findIndex(y => String(y._id || "") === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Financial Year not found." });
      if (mockYears[idx].status === "CLOSED") {
        return res.status(400).json({ success: false, error: "Cannot edit closed financial years." });
      }
      if (name) mockYears[idx].name = name;
      if (remarks) mockYears[idx].remarks = remarks;
      return res.json({ success: true, data: mockYears[idx] });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to update financial year." });
  }
};

/**
 * GET /api/settings/financial-years
 */
export const getFinancialYears = async (req: AuthRequest, res: Response) => {
  try {
    if (isDbConnected()) {
      const list = await FinancialYear.find({}).sort({ startDate: -1 });
      return res.json({ success: true, data: list });
    } else {
      return res.json({ success: true, data: mockYears });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to get financial years." });
  }
};

/**
 * GET /api/settings/financial-years/:id
 */
export const getFinancialYearById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (isDbConnected()) {
      const year = await FinancialYear.findById(id);
      if (!year) return res.status(404).json({ success: false, error: "Financial year not found." });
      return res.json({ success: true, data: year });
    } else {
      const year = mockYears.find(y => String(y._id || "") === id);
      if (!year) return res.status(404).json({ success: false, error: "Financial year not found." });
      return res.json({ success: true, data: year });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to retrieve financial year." });
  }
};

/**
 * PUT /api/settings/financial-years/:id/activate
 */
export const activateFinancialYear = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;

    if (isDbConnected()) {
      const year = await FinancialYear.findById(id);
      if (!year) return res.status(404).json({ success: false, error: "Financial year not found." });

      if (year.status === "CLOSED") {
        return res.status(400).json({ success: false, error: "Cannot activate a closed financial year." });
      }

      // Deactivate current active year
      await FinancialYear.updateMany({ status: "ACTIVE" }, { $set: { status: "CLOSED", isDefault: false, closedAt: new Date(), closedBy: user.email || user.id } });

      year.status = "ACTIVE";
      year.isDefault = true;
      await year.save();

      await sendFYNotification("FY_ACTIVATED", "Financial Year Activated", `Financial year ${year.name} is now ACTIVE.`);
      return res.json({ success: true, data: year });
    } else {
      mockYears.forEach(y => {
        if (y.status === "ACTIVE") {
          y.status = "CLOSED";
          y.isDefault = false;
        }
      });
      const year = mockYears.find(y => String(y._id || "") === id);
      if (!year) return res.status(404).json({ success: false, error: "Financial year not found." });
      year.status = "ACTIVE";
      year.isDefault = true;
      return res.json({ success: true, data: year });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to activate financial year." });
  }
};

/**
 * PUT /api/settings/financial-years/:id/close
 */
export const closeFinancialYear = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    const { id } = req.params;

    if (isDbConnected()) {
      const year = await FinancialYear.findById(id);
      if (!year) return res.status(404).json({ success: false, error: "Financial year not found." });

      // Validate Year End Checklist: Check for draft invoices or pending sales
      const draftInvoicesCount = await Invoice.countDocuments({
        status: "DRAFT",
        createdAt: { $gte: year.startDate, $lte: year.endDate }
      });

      if (draftInvoicesCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot close year. There are ${draftInvoicesCount} draft invoices remaining in this period.`
        });
      }

      year.status = "CLOSED";
      year.isDefault = false;
      year.closedAt = new Date();
      year.closedBy = user.email || user.id;
      await year.save();

      await sendFYNotification("FY_CLOSED", "Financial Year Closed", `Financial year ${year.name} has been CLOSED.`);
      return res.json({ success: true, data: year });
    } else {
      const year = mockYears.find(y => String(y._id || "") === id);
      if (!year) return res.status(404).json({ success: false, error: "Financial year not found." });
      year.status = "CLOSED";
      year.isDefault = false;
      year.closedAt = new Date();
      year.closedBy = user.email || user.id;
      return res.json({ success: true, data: year });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to close financial year." });
  }
};

/**
 * GET /api/settings/financial-years/current
 */
export const getCurrentFinancialYearAPI = async (req: AuthRequest, res: Response) => {
  try {
    if (isDbConnected()) {
      const active = await FinancialYear.findOne({ status: "ACTIVE" });
      if (active) {
        return res.json({ success: true, data: active });
      }
    }
    // Fallback date-check active year
    const activeMock = mockYears.find(y => y.status === "ACTIVE") || mockYears[0];
    return res.json({ success: true, data: activeMock });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: "Failed to get current active financial year." });
  }
};
