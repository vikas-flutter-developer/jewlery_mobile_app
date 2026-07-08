import { Request, Response } from "express";
import {
  ManufacturerInventory,
} from "../../models/index.js";

const normalizeString = (value: unknown, fallback?: string) => {
  const normalized = String(value ?? "").trim();
  if (normalized) return normalized;
  if (typeof fallback !== "undefined") return fallback;
  return undefined;
};

const normalizeEnum = (value: unknown, allowed: string[], fallback?: string) => {
  const v = String(value ?? "").trim();
  if (!v) return typeof fallback !== "undefined" ? fallback : undefined;
  const found = allowed.find(a => a.toLowerCase() === v.toLowerCase());
  if (found) return found;
  return typeof fallback !== "undefined" ? fallback : undefined;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Inventory ───────────────────────────────────────────────────────────────

export const getManufacturerInventory = async (_req: Request, res: Response) => {
  try {
    const inventory = await ManufacturerInventory.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: inventory });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer inventory");
  }
};

export const createManufacturerInventory = async (req: Request, res: Response) => {
  try {
    const barcode = normalizeString(req.body.barcode) || generateId("BARCODE");
    const tag = normalizeString(req.body.tag) || generateId("TAG");
    const payload = {
      sku: normalizeString(req.body.sku) || generateId("SKU"),
      grossWeight: Number(req.body.grossWeight) || 0,
      netWeight: Number(req.body.netWeight) || 0,
      purity: normalizeString(req.body.purity) || "22K",
      fineWeight: Number(req.body.fineWeight) || 0,
      diamondWeight: Number(req.body.diamondWeight) || 0,
      huid: normalizeString(req.body.huid) || generateId("HUID"),
      branchId: normalizeString(req.body.branchId) || "MAIN",
      barcode,
      tag,
      name: normalizeString(req.body.name),
      weight: Number(req.body.weight) || 0,
      type: normalizeString(req.body.type) || "GOLD",
      status: normalizeString(req.body.status) || "In Stock",
      stock: Number(req.body.stock) || 1,
      price: Number(req.body.price) || 0,
      designCode: normalizeString(req.body.designCode),
      showcase: normalizeString(req.body.showcase) || "HQ Vault",
      tray: normalizeString(req.body.tray) || "Main Tray",
      inwardDate: req.body.inwardDate ? new Date(req.body.inwardDate) : new Date(),
      image: normalizeString(req.body.image) || undefined,
      hallmarkCertificate: normalizeString(req.body.hallmarkCertificate),
      gemstoneCertificate: normalizeString(req.body.gemstoneCertificate),
      gemstoneCertificateType: normalizeString(req.body.gemstoneCertificateType, "N/A"),
      condition: normalizeEnum(req.body.condition, ["New", "Display", "Repaired", "Damaged", "Consignment"], "New"),
      vendorId: normalizeString(req.body.vendorId),
      consignmentCommission: Number(req.body.consignmentCommission) || 0,
      diamondCarat: Number(req.body.diamondCarat) || 0,
      diamondCut: normalizeEnum(req.body.diamondCut, ["Excellent", "Very Good", "Good", "Fair", "Poor"]),
      diamondColor: normalizeEnum(req.body.diamondColor, ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "Fancy"]),
      diamondClarity: normalizeEnum(req.body.diamondClarity, ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"]),
      diamondType: normalizeEnum(req.body.diamondType, ["Natural", "Lab-Grown", "Fancy Color", "Simulant"], "Natural"),
    };

    const inventoryItem = new ManufacturerInventory(payload);
    await inventoryItem.save();
    return res.status(201).json({ success: true, data: inventoryItem, message: "Inventory logged to manufacturer database" });
  } catch (error) {
    return respondError(res, error, "Failed to log manufacturer inventory");
  }
};

export const updateManufacturerInventory = async (req: Request, res: Response) => {
  try {
    const updated = await ManufacturerInventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: "Inventory item not found" });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer inventory");
  }
};

export const getManufacturerAdvancedInventory = async (_req: Request, res: Response) => {
  try {
    const advanced = await ManufacturerInventory.find({ $or: [{ isConsignment: true }, { condition: { $ne: "New" } }] }).lean();
    return res.json({ success: true, data: advanced });
  } catch (error) {
    return respondError(res, error, "Failed to load advanced manufacturer inventory");
  }
};

// ─── HUID (part of inventory domain) ────────────────────────────────────────

export const verifyManufacturerHuid = async (req: Request, res: Response) => {
  try {
    const huid = normalizeString(req.params.huid);
    if (!huid) {
      return res.status(400).json({ success: false, error: "HUID is required" });
    }
    const record = await ManufacturerInventory.findOne({ huid });
    if (!record) {
      return res.status(404).json({ success: false, error: "HUID not found" });
    }
    return res.json({ success: true, data: { huid, verified: true, inventory: record } });
  } catch (error) {
    return respondError(res, error, "Failed to verify manufacturer HUID");
  }
};

export const getManufacturerHuidRecords = async (_req: Request, res: Response) => {
  try {
    const items = await ManufacturerInventory.find({ huid: { $exists: true, $ne: "" } }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer HUID records");
  }
};

// ─── Purchases inward (inventory domain) ─────────────────────────────────────

export const createManufacturerPurchaseInward = async (req: Request, res: Response) => {
  try {
    const incoming = {
      sku: normalizeString(req.body.sku) || generateId("PUR"),
      grossWeight: Number(req.body.grossWeight) || 0,
      netWeight: Number(req.body.netWeight) || 0,
      purity: normalizeString(req.body.purity) || "22K",
      fineWeight: Number(req.body.fineWeight) || 0,
      diamondWeight: Number(req.body.diamondWeight) || 0,
      huid: normalizeString(req.body.huid) || generateId("HUID"),
      branchId: normalizeString(req.body.branchId) || "MAIN",
      barcode: normalizeString(req.body.barcode) || generateId("BAR"),
      tag: normalizeString(req.body.tag) || generateId("TAG"),
      name: normalizeString(req.body.name),
      type: normalizeString(req.body.metal) || "GOLD",
      status: normalizeEnum(req.body.status, ["In Stock", "reserved", "sold"], "In Stock"),
      stock: Number(req.body.quantity) || 1,
      price: Number(req.body.price) || 0,
      createdAt: new Date(),
    };
    const inventoryItem = new ManufacturerInventory(incoming);
    await inventoryItem.save();
    return res.status(201).json({ success: true, data: inventoryItem, message: "Manufacturer purchase inward recorded" });
  } catch (error) {
    return respondError(res, error, "Failed to record manufacturer purchase inward");
  }
};
