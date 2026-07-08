import { Request, Response } from "express";
import {
  ManufacturerSubscription,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const getManufacturerSubscriptions = async (_req: Request, res: Response) => {
  try {
    const subscriptions = await ManufacturerSubscription.find().sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, data: subscriptions });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer subscriptions");
  }
};

export const createManufacturerSubscription = async (req: Request, res: Response) => {
  try {
    const payload = {
      id: normalizeString(req.body.id) || generateId("SUB"),
      shopName: normalizeString(req.body.shopName),
      ownerName: normalizeString(req.body.ownerName || "Owner"),
      email: normalizeString(req.body.email).toLowerCase(),
      phone: normalizeString(req.body.phone),
      gstNumber: normalizeString(req.body.gstNumber),
      panNumber: normalizeString(req.body.panNumber),
      aadharNumber: normalizeString(req.body.aadharNumber),
      address: normalizeString(req.body.address),
      planName: normalizeString(req.body.planName, "1YEAR"),
      status: normalizeString(req.body.status, "PENDING"),
      paymentMethod: normalizeString(req.body.paymentMethod, "UPI"),
      paymentStatus: normalizeString(req.body.paymentStatus, "DUE"),
      subscriptionExpiry: normalizeString(req.body.subscriptionExpiry) || new Date(Date.now() + 365*24*60*60*1000).toISOString(),
      joinDate: normalizeString(req.body.joinDate) || new Date().toISOString(),
      storeType: "MANUFACTURER",
      updatedAt: new Date().toISOString()
    };

    if (!payload.shopName || !payload.email || !payload.phone) {
      return res.status(400).json({ success: false, error: "Shop name, email, and phone are required" });
    }

    const sub = new ManufacturerSubscription(payload);
    await sub.save();
    return res.status(201).json({ success: true, data: sub, message: "Manufacturer subscription created successfully" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer subscription");
  }
};

export const updateManufacturerSubscription = async (req: Request, res: Response) => {
  try {
    const updated = await ManufacturerSubscription.findByIdAndUpdate(req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString()
    }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }
    return res.json({ success: true, data: updated, message: "Manufacturer subscription updated successfully" });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer subscription");
  }
};
