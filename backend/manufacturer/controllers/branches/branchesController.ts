import { Request, Response } from "express";
import {
  ManufacturerBranch,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Branches ────────────────────────────────────────────────────────────────

export const getManufacturerBranches = async (_req: Request, res: Response) => {
  try {
    const branches = await ManufacturerBranch.find({ status: "ACTIVE" }).lean();
    return res.json({ success: true, data: branches });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer branches");
  }
};

export const createManufacturerBranch = async (req: Request, res: Response) => {
  try {
    const payload = {
      name: normalizeString(req.body.name),
      code: normalizeString(req.body.code).toUpperCase(),
      address: normalizeString(req.body.address),
      city: normalizeString(req.body.city),
      state: normalizeString(req.body.state),
      pincode: normalizeString(req.body.pincode),
      phone: normalizeString(req.body.phone),
      email: normalizeString(req.body.email),
      managerName: normalizeString(req.body.managerName),
      isMainBranch: !!req.body.isMainBranch,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!payload.name || !payload.code) {
      return res.status(400).json({ success: false, error: "Branch name and code are required" });
    }

    const existing = await ManufacturerBranch.findOne({ code: payload.code });
    if (existing) {
      return res.status(409).json({ success: false, error: "Branch code already exists" });
    }

    const branch = new ManufacturerBranch(payload);
    await branch.save();

    return res.status(201).json({ success: true, data: branch, message: "Branch registered in manufacturer database" });
  } catch (error) {
    return respondError(res, error, "Failed to register branch");
  }
};

export const updateManufacturerBranch = async (req: Request, res: Response) => {
  try {
    const updated = await ManufacturerBranch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Branch not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return respondError(res, error, "Failed to update branch");
  }
};
