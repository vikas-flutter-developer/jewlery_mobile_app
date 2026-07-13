import { Request, Response } from "express";
import {
  ManufacturerBarcode,
} from "../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockManufacturerBarcodes } from "../../../data/mockData.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Barcodes ─────────────────────────────────────────────────────────────────

export const getManufacturerBarcodes = async (req: Request, res: Response) => {
  try {
    const search = normalizeString(req.query.q || req.query.barcode || "");
    
    if (!isDbConnected()) {
      let items = mockManufacturerBarcodes;
      if (search) {
        items = mockManufacturerBarcodes.filter((item: any) => 
          String(item.barcode).toLowerCase().includes(search.toLowerCase()) ||
          String(item.qrCode).toLowerCase().includes(search.toLowerCase()) ||
          String(item.itemName).toLowerCase().includes(search.toLowerCase()) ||
          String(item.itemId).toLowerCase().includes(search.toLowerCase())
        );
      }
      return res.json({ success: true, data: items });
    }

    const filter = search ? { $or: [{ barcode: search }, { qrCode: search }, { itemName: search }, { itemId: search }] } : {};
    const items = await ManufacturerBarcode.find(filter).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    return respondError(res, error, "Failed to fetch manufacturer barcodes");
  }
};

export const createManufacturerBarcode = async (req: Request, res: Response) => {
  try {
    const payload = {
      barcodeId: normalizeString(req.body.barcodeId) || generateId("MFR-BC"),
      itemId: normalizeString(req.body.itemId) || generateId("MFR-ITEM"),
      itemName: normalizeString(req.body.itemName),
      barcode: normalizeString(req.body.barcode) || generateId("MFR"),
      qrCode: normalizeString(req.body.qrCode) || generateId("MFR-QR"),
      weight: Number(req.body.weight) || 0,
      purity: normalizeString(req.body.purity) || "22K",
      price: typeof req.body.price !== 'undefined' ? Number(req.body.price) : undefined,
      certificateNumber: normalizeString(req.body.certificateNumber),
      status: normalizeString(req.body.status, "active"),
    };

    if (!isDbConnected()) {
      const record = {
        ...payload,
        _id: `mock_bc_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      mockManufacturerBarcodes.push(record);
      return res.status(201).json({ success: true, data: record, message: "Manufacturer barcode saved (offline)" });
    }

    const record = new ManufacturerBarcode(payload);
    await record.save();
    return res.status(201).json({ success: true, data: record, message: "Manufacturer barcode saved" });
  } catch (error) {
    return respondError(res, error, "Failed to save manufacturer barcode");
  }
};

export const getManufacturerBarcodeByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, error: "A barcode or lookup code is required" });
    }
    const normalized = String(code).trim();

    if (!isDbConnected()) {
      const item = mockManufacturerBarcodes.find((b: any) => 
        String(b.barcode) === normalized ||
        String(b.qrCode) === normalized ||
        String(b.itemId) === normalized ||
        String(b.barcodeId) === normalized
      );
      if (!item) {
        return res.status(404).json({ success: false, error: "Manufacturer barcode not found (offline)" });
      }
      return res.json({ success: true, data: item });
    }

    const item = await ManufacturerBarcode.findOne({
      $or: [
        { barcode: normalized },
        { qrCode: normalized },
        { itemId: normalized },
        { barcodeId: normalized }
      ]
    }).lean();

    if (!item) {
      return res.status(404).json({ success: false, error: "Manufacturer barcode not found" });
    }
    return res.json({ success: true, data: item });
  } catch (error) {
    return respondError(res, error, "Failed to lookup manufacturer barcode");
  }
};

