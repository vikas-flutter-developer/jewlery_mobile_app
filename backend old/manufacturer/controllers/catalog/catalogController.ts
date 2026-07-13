import { Request, Response } from "express";
import {
  ManufacturerDesign,
  ManufacturerGemstoneParcel,
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

// ─── Catalog / Designs ─────────────────────────────────────────────────────────

export const getManufacturerDesigns = async (_req: Request, res: Response) => {
  try {
    const designs = await ManufacturerDesign.find().lean();
    return res.json({ success: true, data: designs });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer designs");
  }
};

export const createManufacturerDesign = async (req: Request, res: Response) => {
  try {
    const payload = {
      designCode: normalizeString(req.body.designCode) || generateId("DC"),
      name: normalizeString(req.body.name),
      category: normalizeString(req.body.category),
      metalType: normalizeString(req.body.metalType),
      standardPurity: normalizeString(req.body.standardPurity),
      image: normalizeString(req.body.image),
      description: normalizeString(req.body.description),
      minStockThreshold: Number(req.body.minStockThreshold) || 2,
      hasDiamonds: Boolean(req.body.hasDiamonds),
      diamondCut: req.body.hasDiamonds ? normalizeString(req.body.diamondCut) : undefined,
      diamondClarity: req.body.hasDiamonds ? normalizeString(req.body.diamondClarity) : undefined,
      diamondColor: req.body.hasDiamonds ? normalizeString(req.body.diamondColor) : undefined,
      diamondCarat: req.body.hasDiamonds ? Number(req.body.diamondCarat) : undefined,
      units: Number(req.body.units) || 0,
    };

    if (!payload.name || !payload.designCode) {
      return res.status(400).json({ success: false, error: "Design code and name are required" });
    }

    const existing = await ManufacturerDesign.findOne({ designCode: payload.designCode });
    if (existing) {
      return res.status(409).json({ success: false, error: "Design code already exists" });
    }

    const design = new ManufacturerDesign(payload);
    await design.save();
    return res.status(201).json({ success: true, data: design, message: "Manufacturer catalog design created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer design");
  }
};

// ─── Gemstones ─────────────────────────────────────────────────────────────────

export const getManufacturerGemstoneParcels = async (_req: Request, res: Response) => {
  try {
    const parcels = await ManufacturerGemstoneParcel.find().lean();
    return res.json({ success: true, data: parcels });
  } catch (error) {
    return respondError(res, error, "Failed to fetch manufacturer gemstone parcels");
  }
};

export const createManufacturerGemstoneParcel = async (req: Request, res: Response) => {
  try {
    const payload = {
      parcelNumber: normalizeString(req.body.parcelNumber) || generateId("GP"),
      gemstoneType: normalizeString(req.body.gemstoneType),
      weight: Number(req.body.weight) || 0,
      quantity: Number(req.body.quantity) || 1,
      availableWeight: Number(req.body.availableWeight) || Number(req.body.weight) || 0,
      availableQuantity: Number(req.body.availableQuantity) || Number(req.body.quantity) || 1,
      rate: Number(req.body.rate) || 0,
      totalValue: Number(req.body.totalValue) || 0,
      clarity: normalizeString(req.body.clarity),
      color: normalizeString(req.body.color),
      shape: normalizeString(req.body.shape),
      size: normalizeString(req.body.size),
      status: normalizeString(req.body.status, "In Stock"),
      description: normalizeString(req.body.description),
    };
    const parcel = new ManufacturerGemstoneParcel(payload);
    await parcel.save();
    return res.status(201).json({ success: true, data: parcel, message: "Gemstone parcel saved to manufacturer database" });
  } catch (error) {
    return respondError(res, error, "Failed to save gemstone parcel");
  }
};

export const issueManufacturerGemstones = async (req: Request, res: Response) => {
  try {
    const parcelId = normalizeString(req.body.parcelNumber || req.body.parcelId);
    const quantity = Number(req.body.quantity) || 1;
    const weight = Number(req.body.weight) || 0;
    const issuedTo = normalizeString(req.body.issuedTo);

    if (!parcelId || (!quantity && !weight)) {
      return res.status(400).json({ success: false, error: "parcelNumber and quantity or weight are required" });
    }

    let parcel = null;
    if (/^[0-9a-fA-F]{24}$/.test(parcelId)) {
      parcel = await ManufacturerGemstoneParcel.findById(parcelId);
    }
    if (!parcel) {
      parcel = await ManufacturerGemstoneParcel.findOne({ parcelNumber: parcelId });
    }
    if (!parcel) {
      return res.status(404).json({ success: false, error: "Gemstone parcel not found" });
    }

    parcel.availableQuantity = Math.max(0, (parcel.availableQuantity || 0) - quantity);
    parcel.availableWeight = Math.max(0, (parcel.availableWeight || 0) - weight);
    parcel.status = parcel.availableQuantity > 0 ? "Partially Issued" : "Fully Issued";
    parcel.history = parcel.history || [];
    parcel.history.push({ issuedTo, orderId: normalizeString(req.body.orderId), quantity, weight, notes: normalizeString(req.body.notes), issuedAt: new Date() });
    await parcel.save();

    return res.json({ success: true, data: parcel, message: "Gemstone parcel issuance recorded" });
  } catch (error) {
    return respondError(res, error, "Failed to issue gemstone parcel");
  }
};

export const deleteManufacturerDesign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const design = await ManufacturerDesign.findByIdAndDelete(id);
    if (!design) {
      const designByCode = await ManufacturerDesign.findOneAndDelete({ designCode: id });
      if (!designByCode) {
        return res.status(404).json({ success: false, error: "Design not found" });
      }
    }
    return res.json({ success: true, message: "Design successfully deleted" });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer design");
  }
};
