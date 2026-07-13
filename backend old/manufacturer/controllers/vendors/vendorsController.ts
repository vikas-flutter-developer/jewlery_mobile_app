import { Request, Response } from "express";
import {
  ManufacturerVendor,
  ManufacturerKarikar,
  ManufacturerRate,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Rates ──────────────────────────────────────────────────────────────────

export const getManufacturerRates = async (_req: Request, res: Response) => {
  try {
    const rates = await ManufacturerRate.find().lean();
    return res.json({ success: true, data: rates });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer rates");
  }
};

export const updateManufacturerRate = async (req: Request, res: Response) => {
  try {
    const metal = normalizeString(req.params.metal);
    const rateValue = Number(req.body.rate);
    if (!metal || !rateValue) {
      return res.status(400).json({ success: false, error: "Metal and rate are required" });
    }
    const rate = await ManufacturerRate.findOneAndUpdate(
      { metal },
      { rate: rateValue, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    return res.json({ success: true, data: rate });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer rate");
  }
};

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const getManufacturerVendors = async (_req: Request, res: Response) => {
  try {
    const vendors = await ManufacturerVendor.find().lean();
    return res.json({ success: true, data: vendors });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer vendors");
  }
};

export const createManufacturerVendor = async (req: Request, res: Response) => {
  try {
    const vendor = new ManufacturerVendor({
      name: normalizeString(req.body.name),
      type: normalizeString(req.body.type, "MANUFACTURER"),
      gstin: normalizeString(req.body.gstin),
      gst: normalizeString(req.body.gst),
      pan: normalizeString(req.body.pan),
      email: normalizeString(req.body.email),
      phone: normalizeString(req.body.phone),
      address: normalizeString(req.body.address),
      city: normalizeString(req.body.city),
      bank: normalizeString(req.body.bank),
      bankAccount: normalizeString(req.body.bankAccount),
      ifscCode: normalizeString(req.body.ifscCode),
      contactPerson: normalizeString(req.body.contactPerson),
      notes: normalizeString(req.body.notes),
      status: normalizeString(req.body.status, "ACTIVE"),
      metalAccount: req.body.metalAccount || {},
      paymentTerms: normalizeString(req.body.paymentTerms),
      minOrderQty: Number(req.body.minOrderQty) || 0,
      minOrderValue: Number(req.body.minOrderValue) || 0,
    });
    await vendor.save();
    return res.status(201).json({ success: true, data: vendor, message: "Manufacturer vendor saved" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer vendor");
  }
};

export const updateManufacturerVendor = async (req: Request, res: Response) => {
  try {
    const vendor = await ManufacturerVendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vendor) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }
    return res.json({ success: true, data: vendor });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer vendor");
  }
};

export const deleteManufacturerVendor = async (req: Request, res: Response) => {
  try {
    const deleted = await ManufacturerVendor.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }
    return res.json({ success: true, data: deleted, message: "Manufacturer vendor deleted" });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer vendor");
  }
};



// ─── Karikars ────────────────────────────────────────────────────────────────

export const getManufacturerKarikars = async (_req: Request, res: Response) => {
  try {
    const karikars = await ManufacturerKarikar.find().lean();
    return res.json({ success: true, data: karikars });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer karikars");
  }
};

export const createManufacturerKarikar = async (req: Request, res: Response) => {
  try {
    const karikar = new ManufacturerKarikar({
      name: normalizeString(req.body.name),
      phone: normalizeString(req.body.phone),
      village: normalizeString(req.body.village),
      skilled: normalizeString(req.body.skilled, "Goldsmith"),
      status: normalizeString(req.body.status, "ACTIVE"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await karikar.save();
    return res.status(201).json({ success: true, data: karikar, message: "Manufacturer karikar onboarded" });
  } catch (error) {
    return respondError(res, error, "Failed to onboard manufacturer karikar");
  }
};

export const updateManufacturerKarikar = async (req: Request, res: Response) => {
  try {
    const karikar = await ManufacturerKarikar.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!karikar) {
      return res.status(404).json({ success: false, error: "Karikar not found" });
    }
    return res.json({ success: true, data: karikar });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer karikar");
  }
};

export const deleteManufacturerKarikar = async (req: Request, res: Response) => {
  try {
    const deleted = await ManufacturerKarikar.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Karikar not found" });
    }
    return res.json({ success: true, data: deleted, message: "Manufacturer karikar deleted successfully" });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer karikar");
  }
};

// ─── Karikar Metal Return ────────────────────────────────────────────────────

export const recordManufacturerKarikarMetalReturn = async (req: Request, res: Response) => {
  try {
    const karikar = await ManufacturerKarikar.findById(req.params.id);
    if (!karikar) {
      return res.status(404).json({ success: false, error: "Karikar not found" });
    }
    const returnEntry = {
      weight: Number(req.body.weight) || 0,
      purity: normalizeString(req.body.purity, "22K"),
      note: normalizeString(req.body.note),
      returnedAt: new Date(),
    };
    if (!Array.isArray((karikar as any).metalReturns)) {
      (karikar as any).metalReturns = [];
    }
    (karikar as any).metalReturns.push(returnEntry);
    // Deduct from gold stock
    const deduction = returnEntry.weight;
    (karikar as any).goldStock = Math.max(0, ((karikar as any).goldStock || 0) - deduction);
    await karikar.save();
    return res.status(201).json({ success: true, data: returnEntry, message: "Metal return recorded" });
  } catch (error) {
    return respondError(res, error, "Failed to record metal return");
  }
};

// ─── Karikar Self-Service Portal ─────────────────────────────────────────────

export const getManufacturerKarikarSelfService = async (req: Request, res: Response) => {
  try {
    const karikar = await ManufacturerKarikar.findById(req.params.id).lean();
    if (!karikar) {
      return res.status(404).json({ success: false, error: "Karikar not found" });
    }
    return res.json({
      success: true,
      data: {
        karikar,
        jobCards: (karikar as any).jobCards || [],
        settlements: (karikar as any).settlements || [],
        metalReturns: (karikar as any).metalReturns || [],
        goldStock: (karikar as any).goldStock || 0,
        ledgerBalance: (karikar as any).ledgerBalance || 0,
      },
    });
  } catch (error) {
    return respondError(res, error, "Failed to load karikar self-service data");
  }
};

export const createManufacturerRate = async (req: Request, res: Response) => {
  try {
    const metal = normalizeString(req.body.metal);
    const purity = normalizeString(req.body.purity, "24K");
    const rateValue = Number(req.body.rate);
    const makingPercent = Number(req.body.makingPercent) || 0;
    const gstPercent = Number(req.body.gstPercent) || 0;
    const effectivePrice = Math.round(rateValue * (1 + makingPercent / 100) * (1 + gstPercent / 100));

    if (!metal || !rateValue) {
      return res.status(400).json({ success: false, error: "Metal and rate are required" });
    }

    const rate = await ManufacturerRate.findOneAndUpdate(
      { metal, purity },
      { 
        rate: rateValue, 
        makingPercent, 
        gstPercent, 
        effectivePrice,
        updatedAt: new Date() 
      },
      { new: true, upsert: true }
    );
    return res.status(201).json({ success: true, data: rate });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer rate");
  }
};

export const deleteManufacturerRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Rate ID or metal parameter is required" });
    }

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      const deleted = await ManufacturerRate.findByIdAndDelete(id);
      if (deleted) {
        return res.json({ success: true, message: "Rate successfully deleted" });
      }
    }

    // Fallback: delete by metal name
    const deletedMany = await ManufacturerRate.deleteMany({
      metal: { $regex: new RegExp(`^${id}$`, "i") }
    });
    return res.json({ success: true, deletedCount: deletedMany.deletedCount });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer rate");
  }
};

