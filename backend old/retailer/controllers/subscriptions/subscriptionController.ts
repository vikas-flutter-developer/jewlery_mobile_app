import { Request, Response } from "express";
import { Subscription } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

export const getRetailerSubscriptions = async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      const subscriptions = await Subscription.find().sort({ updatedAt: -1 }).lean();
      return res.json({ success: true, data: subscriptions });
    }
    return res.json({ success: true, data: [] });
  } catch (error) {
    return respondError(res, error, "Failed to load retailer subscriptions");
  }
};

export const createRetailerSubscription = async (req: Request, res: Response) => {
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
      storeType: "RETAILER",
      updatedAt: new Date().toISOString()
    };

    if (!payload.shopName || !payload.email || !payload.phone) {
      return res.status(400).json({ success: false, error: "Shop name, email, and phone are required" });
    }

    if (isDbConnected()) {
      const sub = new Subscription(payload);
      await sub.save();
      return res.status(201).json({ success: true, data: sub, message: "Retailer subscription created successfully" });
    }
    return res.status(201).json({ success: true, data: payload, message: "Retailer subscription created successfully (mock)" });
  } catch (error) {
    return respondError(res, error, "Failed to create retailer subscription");
  }
};

export const updateRetailerSubscription = async (req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      const updated = await Subscription.findByIdAndUpdate(req.params.id, {
        ...req.body,
        updatedAt: new Date().toISOString()
      }, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, error: "Subscription not found" });
      }
      return res.json({ success: true, data: updated, message: "Retailer subscription updated successfully" });
    }
    return res.json({ success: true, data: { ...req.body, id: req.params.id }, message: "Retailer subscription updated successfully (mock)" });
  } catch (error) {
    return respondError(res, error, "Failed to update retailer subscription");
  }
};
