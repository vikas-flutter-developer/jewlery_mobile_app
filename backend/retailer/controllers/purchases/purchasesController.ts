import { Request, Response } from "express";
import { Inventory } from "../../models/index.js";
import { mockInventory } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

const sanitizeToken = (value: string) =>
  value
    .replace(/[^A-Z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const generateBarcode = () => `PUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const generateTag = (supplier: string, item: string) => `TAG-${sanitizeToken(supplier)}-${sanitizeToken(item)}-${Date.now().toString(36).toUpperCase()}`;

const mapInventoryStatus = (status: string) => {
  if (status === "RECEIVED") return "In Stock";
  return "reserved";
};

const parseInwardPayload = (req: Request) => {
  const {
    supplier,
    item,
    metal = "Gold",
    purity = "22K",
    weight,
    rate = 0,
    makingCharges = 0,
    status = "PENDING",
    branchId = "MAIN",
    huid,
    quantity = 1,
  } = req.body ?? {};

  if (!supplier || !item) {
    throw new Error("supplier and item are required");
  }

  const parsedWeight = toNumber(weight, NaN);
  const parsedRate = toNumber(rate, 0);
  const parsedMakingCharges = toNumber(makingCharges, 0);
  const parsedQuantity = Math.max(1, Math.floor(toNumber(quantity, 1)));

  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
    throw new Error("weight must be a positive number");
  }

  const totalCost = roundToTwo(parsedWeight * parsedRate + parsedMakingCharges);

  return {
    supplier: String(supplier),
    item: String(item),
    metal: String(metal),
    purity: String(purity),
    weight: parsedWeight,
    rate: parsedRate,
    makingCharges: parsedMakingCharges,
    status: String(status),
    branchId: String(branchId),
    huid: huid ? String(huid) : `HUID-${Date.now()}`,
    quantity: parsedQuantity,
    totalCost,
  };
};

export const postInward = async (req: Request, res: Response) => {
  try {
    const payload = parseInwardPayload(req);
    const barcode = generateBarcode();
    const tag = generateTag(payload.supplier, payload.item);

    const inventoryRecord = {
      sku: `${sanitizeToken(payload.supplier)}-${sanitizeToken(payload.item)}`,
      grossWeight: payload.weight,
      netWeight: payload.weight,
      purity: payload.purity,
      fineWeight: payload.weight,
      diamondWeight: 0,
      huid: payload.huid,
      image: undefined,
      branchId: payload.branchId,
      barcode,
      tag,
      name: payload.item,
      weight: payload.weight,
      type: payload.metal,
      status: mapInventoryStatus(payload.status),
      stock: payload.quantity,
      price: payload.totalCost,
      createdAt: new Date().toISOString(),
    };

    if (!isDbConnected()) {
      mockInventory.push({
        _id: `mock_purchase_${Date.now()}`,
        ...inventoryRecord,
      } as any);

      return res.status(201).json({
        success: true,
        message: "Purchase inward logged",
        data: {
          purchaseId: `PUR-${Date.now()}`,
          supplier: payload.supplier,
          item: payload.item,
          metal: payload.metal,
          purity: payload.purity,
          weight: payload.weight,
          rate: payload.rate,
          makingCharges: payload.makingCharges,
          quantity: payload.quantity,
          totalCost: payload.totalCost,
          status: payload.status,
          branchId: payload.branchId,
          inventory: inventoryRecord,
        },
      });
    }

    const savedInventory = new Inventory(inventoryRecord);
    await savedInventory.save();

    return res.status(201).json({
      success: true,
      message: "Purchase inward logged",
      data: {
        purchaseId: `PUR-${Date.now()}`,
        supplier: payload.supplier,
        item: payload.item,
        metal: payload.metal,
        purity: payload.purity,
        weight: payload.weight,
        rate: payload.rate,
        makingCharges: payload.makingCharges,
        quantity: payload.quantity,
        totalCost: payload.totalCost,
        status: payload.status,
        branchId: payload.branchId,
        inventory: savedInventory.toObject(),
      },
    });
  } catch (error: any) {
    const statusCode = error?.message?.includes("required") || error?.message?.includes("positive") ? 400 : 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to log purchase inward",
    });
  }
};


