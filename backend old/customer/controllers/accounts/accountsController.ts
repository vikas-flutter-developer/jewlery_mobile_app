import { Request, Response } from "express";
import { CustomerAccount } from "../../models/index.js";
import { Customer } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

// ─── In-memory fallback store ───────────────────────────────────────────────
const mockAccounts: any[] = [
  {
    _id: "acct_001",
    customerId: "cust_portal_1",
    phone: "9999999999",
    name: "Raj Kumar",
    status: "ACTIVE",
    lastLogin: new Date().toISOString(),
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── CREATE account (auto-called on first OTP verify) ───────────────────────
export const createAccount = async (req: Request, res: Response) => {
  try {
    const { phone, name, customerId } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone is required." });
    }

    if (isDbConnected()) {
      // Avoid duplicates
      const existing = await CustomerAccount.findOne({ phone });
      if (existing) {
        return res.status(200).json({ success: true, data: existing, message: "Account already exists." });
      }

      // Auto-resolve customerId from Customer collection if not provided
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId) {
        const cust = await Customer.findOne({ phone }).lean() as any;
        resolvedCustomerId = cust?._id?.toString() || `cust_${Date.now()}`;
      }

      const account = await CustomerAccount.create({
        customerId: resolvedCustomerId,
        phone,
        name: name || "Portal Customer",
        status: "ACTIVE",
        lastLogin: new Date(),
      });

      return res.status(201).json({ success: true, data: account });
    } else {
      const existing = mockAccounts.find((a) => a.phone === phone);
      if (existing) {
        return res.status(200).json({ success: true, data: existing, message: "Account already exists." });
      }
      const account = {
        _id: `acct_${Date.now()}`,
        customerId: customerId || `cust_${Date.now()}`,
        phone,
        name: name || "Portal Customer",
        status: "ACTIVE",
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      mockAccounts.push(account);
      return res.status(201).json({ success: true, data: account });
    }
  } catch (error: any) {
    console.error("Create account error", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create account." });
  }
};

// ─── GET ALL accounts (admin view) ─────────────────────────────────────────
export const getAllAccounts = async (_req: Request, res: Response) => {
  try {
    let accounts: any[];
    if (isDbConnected()) {
      accounts = await CustomerAccount.find().sort({ createdAt: -1 }).lean();
    } else {
      accounts = mockAccounts;
    }
    return res.json({ success: true, data: accounts, total: accounts.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET ACTIVE accounts only ───────────────────────────────────────────────
export const getActiveAccounts = async (_req: Request, res: Response) => {
  try {
    let accounts: any[];
    if (isDbConnected()) {
      accounts = await CustomerAccount.find({ status: "ACTIVE" }).sort({ lastLogin: -1 }).lean();
    } else {
      accounts = mockAccounts.filter((a) => a.status === "ACTIVE");
    }
    return res.json({ success: true, data: accounts, total: accounts.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET single account by phone ────────────────────────────────────────────
export const getAccountByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    let account: any;
    if (isDbConnected()) {
      account = await CustomerAccount.findOne({ phone }).lean();
    } else {
      account = mockAccounts.find((a) => a.phone === phone);
    }
    if (!account) {
      return res.status(404).json({ success: false, error: "Account not found." });
    }
    return res.json({ success: true, data: account });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── UPDATE account (name, status) ──────────────────────────────────────────
export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const updates = req.body;
    let account: any;
    if (isDbConnected()) {
      account = await CustomerAccount.findOneAndUpdate({ phone }, updates, { new: true });
    } else {
      const idx = mockAccounts.findIndex((a) => a.phone === phone);
      if (idx === -1) return res.status(404).json({ success: false, error: "Account not found." });
      mockAccounts[idx] = { ...mockAccounts[idx], ...updates };
      account = mockAccounts[idx];
    }
    return res.json({ success: true, data: account });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── DEACTIVATE account ──────────────────────────────────────────────────────
export const deactivateAccount = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    if (isDbConnected()) {
      await CustomerAccount.findOneAndUpdate({ phone }, { status: "INACTIVE" });
    } else {
      const idx = mockAccounts.findIndex((a) => a.phone === phone);
      if (idx !== -1) mockAccounts[idx].status = "INACTIVE";
    }
    return res.json({ success: true, message: "Account deactivated successfully." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── RECORD last login (called on OTP verify) ───────────────────────────────
export const recordLogin = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: "Phone required." });
    if (isDbConnected()) {
      await CustomerAccount.findOneAndUpdate({ phone }, { lastLogin: new Date(), status: "ACTIVE" }, { upsert: true });
    } else {
      const idx = mockAccounts.findIndex((a) => a.phone === phone);
      if (idx !== -1) {
        mockAccounts[idx].lastLogin = new Date().toISOString();
        mockAccounts[idx].status = "ACTIVE";
      }
    }
    return res.json({ success: true, message: "Login recorded." });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
