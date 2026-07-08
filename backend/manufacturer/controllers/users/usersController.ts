import { Request, Response } from "express";
import {
  ManufacturerUser,
} from "../../models/index.js";
import { AuthRequest } from "../../../lib/authUtils.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Users ───────────────────────────────────────────────────────────────────

export const getManufacturerUsers = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const filter = tenantId ? { tenantId } : {};
    const users = await ManufacturerUser.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: users });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer users");
  }
};

export const createManufacturerUser = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || normalizeString(req.body.tenantId);
    const user = new ManufacturerUser({
      name: normalizeString(req.body.name),
      email: normalizeString(req.body.email),
      password: normalizeString(req.body.password),
      role: normalizeString(req.body.role, "ADMIN"),
      phone: normalizeString(req.body.phone),
      branchId: normalizeString(req.body.branchId),
      tenantId: tenantId,
      status: normalizeString(req.body.status, "ACTIVE"),
      permissions: Array.isArray(req.body.permissions) ? req.body.permissions : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await user.save();
    return res.status(201).json({ success: true, data: user, message: "Manufacturer user onboarded" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer user");
  }
};

export const deleteManufacturerUser = async (req: Request, res: Response) => {
  try {
    const deleted = await ManufacturerUser.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.json({ success: true, data: deleted, message: "Manufacturer user deleted" });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer user");
  }
};
