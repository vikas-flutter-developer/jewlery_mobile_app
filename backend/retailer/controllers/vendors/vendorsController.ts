import { Request, Response } from "express";
import mongoose from "mongoose";
import { Vendor } from "../../models/index.js";
import {
  addFallbackVendor,
  findFallbackVendorById,
  findFallbackVendorByPhone,
  getAllFallbackVendors,
  updateFallbackVendor,
} from "../../../lib/fallbackStore.js";

const normalizeVendor = (vendor: any) => ({
  id: vendor._id || vendor.id,
  name: vendor.name || "",
  email: vendor.email || "",
  phone: vendor.phone || "",
  gst: vendor.gst || vendor.gstin || "",
  pan: vendor.pan || "",
  bank: vendor.bank || vendor.bankAccount || "",
  contactPerson: vendor.contactPerson || "",
  notes: vendor.notes || "",
  type: vendor.type || "SERVICE_PROVIDER",
  address: vendor.address || null,
  city: vendor.city || null,
  metalAccount: vendor.metalAccount || {
    goldBalance: 0,
    silverBalance: 0,
    platinumBalance: 0,
  },
  ledgerAccountId: vendor.ledgerAccountId || null,
  status: vendor.status || "ACTIVE",
  createdAt: vendor.createdAt || null,
  updatedAt: vendor.updatedAt || null,
  minOrderQty: vendor.minOrderQty || 0,
  minOrderValue: vendor.minOrderValue || 0,
  rateContracts: vendor.rateContracts || [],
});

const createFallbackVendor = async (payload: any) => {
  const id = `vendor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const vendor = {
    _id: id,
    name: payload.name,
    type: payload.type || "SERVICE_PROVIDER",
    gstin: payload.gst || payload.gstin || undefined,
    gst: payload.gst || payload.gstin || undefined,
    pan: payload.pan || undefined,
    email: payload.email || undefined,
    phone: payload.phone,
    bank: payload.bank || undefined,
    bankAccount: payload.bank || undefined,
    contactPerson: payload.contactPerson || undefined,
    notes: payload.notes || undefined,
    address: payload.address || undefined,
    city: payload.city || undefined,
    metalAccount: payload.metalAccount || {
      goldBalance: 0,
      silverBalance: 0,
      platinumBalance: 0,
    },
    ledgerAccountId: payload.ledgerAccountId || `ledger-${id}`,
    status: payload.status || "ACTIVE",
    minOrderQty: payload.minOrderQty || 0,
    minOrderValue: payload.minOrderValue || 0,
    rateContracts: payload.rateContracts || [],
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };

  await addFallbackVendor(vendor);
  return vendor;
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const vendors = await getAllFallbackVendors();
      const filtered = vendors.filter((vendor) => {
        if (type && vendor.type !== type) return false;
        if (status && vendor.status !== status) return false;
        return true;
      });

      return res.json({
        success: true,
        data: filtered.map(normalizeVendor),
      });
    }

    const query: any = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const vendors = await Vendor.find(query);
    return res.json({
      success: true,
      data: vendors.map(normalizeVendor),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const createVendor = async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      gst,
      gstin,
      pan,
      email,
      phone,
      address,
      city,
      bank,
      bankAccount,
      ifscCode,
      contactPerson,
      notes,
      minOrderQty,
      minOrderValue,
      rateContracts,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const dbReady = mongoose.connection.readyState === 1;

    if (dbReady) {
      const existingVendor = await Vendor.findOne({ phone } as any);
      if (existingVendor) {
        return res.status(409).json({ error: "Vendor with this phone already exists" });
      }

      const vendor = new Vendor({
        name,
        type: type || "SERVICE_PROVIDER",
        gstin: gst || gstin,
        gst: gst || gstin,
        pan,
        email,
        phone,
        address,
        city,
        bank: bank || bankAccount,
        bankAccount: bank || bankAccount,
        ifscCode,
        contactPerson,
        notes,
        minOrderQty: minOrderQty || 0,
        minOrderValue: minOrderValue || 0,
        rateContracts: rateContracts || [],
        ledgerAccountId: `ledger-${Date.now()}`,
      });

      await vendor.save();

      return res.status(201).json({
        success: true,
        message: "Vendor created successfully",
        data: normalizeVendor(vendor.toObject()),
      });
    }

    const existingFallback = await findFallbackVendorByPhone(phone);
    if (existingFallback) {
      return res.status(409).json({ error: "Vendor with this phone already exists" });
    }

    const vendor = await createFallbackVendor({
      name,
      type: type || "SERVICE_PROVIDER",
      gst: gst || gstin,
      gstin: gst || gstin,
      pan,
      email,
      phone,
      address,
      city,
      bank: bank || bankAccount,
      bankAccount: bank || bankAccount,
      ifscCode,
      contactPerson,
      notes,
      minOrderQty: minOrderQty || 0,
      minOrderValue: minOrderValue || 0,
      rateContracts: rateContracts || [],
    });

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: normalizeVendor(vendor),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getVendorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const vendor = await findFallbackVendorById(id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      return res.json({
        success: true,
        data: normalizeVendor(vendor),
      });
    }

    const vendor = await Vendor.findOne({ _id: id } as any);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    return res.json({
      success: true,
      data: normalizeVendor(vendor.toObject()),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getVendorLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const vendor = await findFallbackVendorById(id);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      return res.json({
        success: true,
        data: {
          vendor: normalizeVendor(vendor),
          ledgerAccountId: vendor.ledgerAccountId || null,
          entries: [],
          balance: vendor.metalAccount || {
            goldBalance: 0,
            silverBalance: 0,
            platinumBalance: 0,
          },
        },
      });
    }

    const vendor = await Vendor.findOne({ _id: id } as any);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    return res.json({
      success: true,
      data: {
        vendor: normalizeVendor(vendor.toObject()),
        ledgerAccountId: vendor.ledgerAccountId || null,
        entries: [],
        balance: vendor.metalAccount || {
          goldBalance: 0,
          silverBalance: 0,
          platinumBalance: 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const existing = await findFallbackVendorById(id);
      if (!existing) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      const updated = await updateFallbackVendor({
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        data: normalizeVendor(updated),
      });
    }

    const vendor = await Vendor.findByIdAndUpdate(id as any, updates as any, { new: true } as any);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const vendorRecord = (vendor as any)?.toObject ? (vendor as any).toObject() : vendor;
    return res.json({
      success: true,
      data: normalizeVendor(vendorRecord),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const vendor = await findFallbackVendorById(id);
      if (!vendor) return res.status(404).json({ error: "Vendor not found" });
      return res.json({ success: true });
    }

    const vendor = await Vendor.findByIdAndDelete(id as any);
    if (!vendor) return res.status(404).json({ error: "Vendor not found" });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};


