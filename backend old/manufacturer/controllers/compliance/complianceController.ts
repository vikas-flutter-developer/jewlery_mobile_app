import { Request, Response } from "express";
import {
  ManufacturerComplianceRecord,
  ManufacturerHallmarkBatch,
  ManufacturerOffer,
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

// ─── Compliance ──────────────────────────────────────────────────────────────

export const getManufacturerComplianceRecords = async (_req: Request, res: Response) => {
  try {
    const records = await ManufacturerComplianceRecord.find().lean();
    return res.json({ success: true, data: records });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer compliance records");
  }
};

export const createManufacturerComplianceRecord = async (req: Request, res: Response) => {
  try {
    const compliance = new ManufacturerComplianceRecord({
      caseId: normalizeString(req.body.caseId) || generateId("CMP"),
      category: normalizeString(req.body.category, "GENERAL"),
      description: normalizeString(req.body.description),
      status: normalizeString(req.body.status, "OPEN"),
      assignedTo: normalizeString(req.body.assignedTo),
      notes: Array.isArray(req.body.notes) ? req.body.notes : [normalizeString(req.body.notes)],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await compliance.save();
    return res.status(201).json({ success: true, data: compliance, message: "Manufacturer compliance record created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer compliance record");
  }
};

// ─── Hallmarking ──────────────────────────────────────────────────────────────

export const getManufacturerHallmarkBatches = async (_req: Request, res: Response) => {
  try {
    const batches = await ManufacturerHallmarkBatch.find().lean();
    return res.json({ success: true, data: batches });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer hallmarking batches");
  }
};

export const createManufacturerHallmarkBatch = async (req: Request, res: Response) => {
  try {
    const batch = new ManufacturerHallmarkBatch({
      batchId: normalizeString(req.body.batchId) || generateId("HB"),
      name: normalizeString(req.body.name),
      items: req.body.items || [],
      hallmarkDate: req.body.hallmarkDate ? new Date(req.body.hallmarkDate) : new Date(),
      status: normalizeString(req.body.status, "CREATED"),
      createdAt: new Date(),
    });
    await batch.save();
    return res.status(201).json({ success: true, data: batch, message: "Manufacturer hallmark batch created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer hallmark batch");
  }
};

// ─── Offers ───────────────────────────────────────────────────────────────────

export const getManufacturerOffers = async (_req: Request, res: Response) => {
  try {
    const offers = await ManufacturerOffer.find().lean();
    const formattedOffers = offers.map((offer: any) => ({
      ...offer,
      id: offer._id.toString(),
      code: offer.code || offer.offerId,
      name: offer.name || offer.offerName,
      validFrom: offer.validFrom || offer.startDate,
      validTo: offer.validTo || offer.endDate,
      discountPercent: offer.discountPercent !== undefined ? offer.discountPercent : offer.discountPercentage,
    }));
    return res.json({ success: true, data: formattedOffers });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer offers");
  }
};

export const createManufacturerOffer = async (req: Request, res: Response) => {
  try {
    const body = { ...req.body };
    
    // Map frontend fields to backend schema fields
    if (body.code && !body.offerId) body.offerId = body.code;
    if (body.name && !body.offerName) body.offerName = body.name;
    if (body.discountPercent !== undefined && body.discountPercentage === undefined) {
      body.discountPercentage = body.discountPercent;
    }
    if (body.validFrom && !body.startDate) body.startDate = new Date(body.validFrom);
    if (body.validTo && !body.endDate) body.endDate = new Date(body.validTo);
    if (!body.offerType) body.offerType = "discount";

    // Also map backend schema fields to frontend fields for safety/redundancy
    if (body.offerId && !body.code) body.code = body.offerId;
    if (body.offerName && !body.name) body.name = body.offerName;
    if (body.discountPercentage !== undefined && body.discountPercent === undefined) {
      body.discountPercent = body.discountPercentage;
    }
    if (body.startDate && !body.validFrom) body.validFrom = body.startDate;
    if (body.endDate && !body.validTo) body.validTo = body.endDate;

    const offer = new ManufacturerOffer({
      ...body,
      createdAt: new Date(),
    });
    await offer.save();

    const offerObj = offer.toObject();
    const formattedOffer = {
      ...offerObj,
      id: offerObj._id.toString(),
      code: offerObj.code || offerObj.offerId,
      name: offerObj.name || offerObj.offerName,
      validFrom: offerObj.validFrom || offerObj.startDate,
      validTo: offerObj.validTo || offerObj.endDate,
      discountPercent: offerObj.discountPercent !== undefined ? offerObj.discountPercent : offerObj.discountPercentage,
    };

    return res.status(201).json({ success: true, data: formattedOffer, message: "Manufacturer offer created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer offer");
  }
};

export const validateManufacturerOffer = async (req: Request, res: Response) => {
  try {
    const code = normalizeString(req.params.code);
    if (!code) {
      return res.status(400).json({ success: false, error: "Offer code is required" });
    }
    const offer = await ManufacturerOffer.findOne({
      $or: [{ code: code }, { offerId: code }]
    }).lean();
    if (!offer) {
      return res.status(404).json({ success: false, error: "Offer not found or expired" });
    }
    const now = new Date();
    const endDate = offer.endDate || (offer as any).validTo;
    if (endDate && new Date(endDate) < now) {
      return res.status(410).json({ success: false, error: "Offer has expired" });
    }

    const formattedOffer = {
      ...offer,
      id: offer._id.toString(),
      code: offer.code || offer.offerId,
      name: offer.name || offer.offerName,
      validFrom: (offer as any).validFrom || offer.startDate,
      validTo: (offer as any).validTo || offer.endDate,
      discountPercent: (offer as any).discountPercent !== undefined ? (offer as any).discountPercent : offer.discountPercentage,
    };

    return res.json({ success: true, data: formattedOffer });
  } catch (error) {
    return respondError(res, error, "Failed to validate manufacturer offer");
  }
};

export const deleteManufacturerOffer = async (req: Request, res: Response) => {
  try {
    const deleted = await ManufacturerOffer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Offer not found" });
    }
    return res.json({ success: true, data: deleted, message: "Manufacturer offer deleted" });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer offer");
  }
};
