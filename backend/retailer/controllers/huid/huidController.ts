import { Request, Response } from "express";
import { Inventory } from "../../models/index.js";
import { mockInventory } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

const normalizeHuid = (value: string) => String(value || "").trim().toUpperCase();

const findInventoryByHuid = async (huid: string) => {
  const normalizedHuid = normalizeHuid(huid);

  if (!normalizedHuid) {
    return null;
  }

  if (!isDbConnected()) {
    return mockInventory.find((item: any) => normalizeHuid(String(item.huid || "")) === normalizedHuid) ?? null;
  }

  const record = await Inventory.findOne({ huid: normalizedHuid });
  return record ? record.toObject() : null;
};

export const verifyHuid = async (req: Request, res: Response) => {
  try {
    const huid = normalizeHuid(req.params.huid ?? "");

    if (!huid) {
      return res.status(400).json({ success: false, error: "huid is required" });
    }

    const record = await findInventoryByHuid(huid);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "HUID not found",
        data: {
          huid,
          verified: false,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        huid,
        verified: true,
        status: record.status || "In Stock",
        source: isDbConnected() ? "database" : "fallback",
        inventoryId: record._id || record.id || null,
        sku: record.sku || null,
        branchId: record.branchId || null,
        verifiedAt: new Date().toISOString(),
        verifiedBy: req.body?.verifiedBy || null,
      },
    });
  } catch (error) {
    console.error("Failed to verify HUID", error);
    return res.status(500).json({ success: false, error: "Failed to verify HUID" });
  }
};

export const getAllHuids = async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      const items = mockInventory.filter((item: any) => !!item.huid);
      return res.json({ success: true, data: items });
    }

    const records = await Inventory.find({ huid: { $exists: true, $ne: "" } });
    return res.json({ success: true, data: records });
  } catch (error) {
    console.error("Failed to fetch all HUID records", error);
    return res.status(500).json({ success: false, error: "Failed to fetch all HUID records" });
  }
};

