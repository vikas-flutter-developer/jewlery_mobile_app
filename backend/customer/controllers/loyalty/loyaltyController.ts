import { Request, Response } from "express";
import { CustomerLoyaltyPoints } from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";

// ─── In-memory fallback ──────────────────────────────────────────────────────
const mockLoyalty: any[] = [
  {
    _id: "lp_001",
    customerId: "cust_portal_1",
    customerPhone: "9999999999",
    points: 1250,
    history: [
      { pointsAdded: 500, reason: "First purchase bonus", date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
      { pointsAdded: 750, reason: "Scheme installment reward", date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
];

// ─── GET loyalty points by phone ─────────────────────────────────────────────
export const getLoyaltyByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    let record: any;
    if (isDbConnected()) {
      record = await CustomerLoyaltyPoints.findOne({ customerPhone: phone }).lean();
    } else {
      record = mockLoyalty.find((l) => l.customerPhone === phone);
    }
    if (!record) {
      return res.status(404).json({ success: false, error: "No loyalty record found for this customer." });
    }
    return res.json({ success: true, data: record });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── GET ALL loyalty records (admin view) ───────────────────────────────────
export const getAllLoyalty = async (_req: Request, res: Response) => {
  try {
    let records: any[];
    if (isDbConnected()) {
      records = await CustomerLoyaltyPoints.find().sort({ points: -1 }).lean();
    } else {
      records = mockLoyalty;
    }
    return res.json({ success: true, data: records, total: records.length });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── ADD points (called on purchase/scheme payment) ──────────────────────────
export const addPoints = async (req: Request, res: Response) => {
  try {
    const { customerId, customerPhone, pointsAdded, reason } = req.body;
    if (!customerPhone || !pointsAdded) {
      return res.status(400).json({ success: false, error: "customerPhone and pointsAdded are required." });
    }

    const histEntry = {
      pointsAdded: Number(pointsAdded),
      reason: reason || "Purchase reward",
      date: new Date(),
    };

    if (isDbConnected()) {
      const record = await CustomerLoyaltyPoints.findOneAndUpdate(
        { customerPhone },
        {
          $inc: { points: Number(pointsAdded) },
          $push: { history: histEntry },
          $setOnInsert: { customerId: customerId || customerPhone },
        },
        { upsert: true, new: true }
      );
      return res.json({ success: true, data: record, message: `${pointsAdded} points added successfully.` });
    } else {
      let record = mockLoyalty.find((l) => l.customerPhone === customerPhone);
      if (!record) {
        record = {
          _id: `lp_${Date.now()}`,
          customerId: customerId || customerPhone,
          customerPhone,
          points: 0,
          history: [],
        };
        mockLoyalty.push(record);
      }
      record.points += Number(pointsAdded);
      record.history.push({ ...histEntry, date: histEntry.date.toISOString() });
      return res.json({ success: true, data: record, message: `${pointsAdded} points added successfully.` });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── REDEEM points ───────────────────────────────────────────────────────────
export const redeemPoints = async (req: Request, res: Response) => {
  try {
    const { customerPhone, pointsToRedeem, reason } = req.body;
    if (!customerPhone || !pointsToRedeem) {
      return res.status(400).json({ success: false, error: "customerPhone and pointsToRedeem are required." });
    }

    const pts = Number(pointsToRedeem);

    if (isDbConnected()) {
      const record = await CustomerLoyaltyPoints.findOne({ customerPhone });
      if (!record) return res.status(404).json({ success: false, error: "Loyalty record not found." });
      if (record.points < pts) {
        return res.status(400).json({ success: false, error: "Insufficient points balance." });
      }
      record.points -= pts;
      (record.history as any[]).push({ pointsAdded: -pts, reason: reason || "Redeemed", date: new Date() });
      await record.save();
      return res.json({ success: true, data: record, message: `${pts} points redeemed.` });
    } else {
      const record = mockLoyalty.find((l) => l.customerPhone === customerPhone);
      if (!record) return res.status(404).json({ success: false, error: "Loyalty record not found." });
      if (record.points < pts) return res.status(400).json({ success: false, error: "Insufficient points." });
      record.points -= pts;
      record.history.push({ pointsAdded: -pts, reason: reason || "Redeemed", date: new Date().toISOString() });
      return res.json({ success: true, data: record, message: `${pts} points redeemed.` });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
