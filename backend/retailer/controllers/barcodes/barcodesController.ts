import { Request, Response } from "express";
import { Inventory, Barcode } from "../../models/index.js";
import { mockInventory, mockRetailerBarcodes } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

type BarcodeLookupItem = {
  _id: string | null;
  sku?: string | null;
  name: string;
  barcode?: string | null;
  tag?: string | null;
  purity?: string | null;
  weight?: number | null;
  price?: number | null;
  stock?: number;
  type?: string | null;
  branchId?: string | null;
  image?: string | null;
};

const normalizeItem = (item: any): BarcodeLookupItem => ({
  _id: item?._id ? String(item._id) : null,
  sku: item?.sku ? String(item.sku) : null,
  name: item?.name ? String(item.name) : item?.sku ? String(item.sku) : "Unknown Item",
  barcode: item?.barcode ? String(item.barcode) : null,
  tag: item?.tag ? String(item.tag) : null,
  purity: item?.purity ? String(item.purity) : null,
  weight: item?.weight ?? item?.netWeight ?? null,
  price: item?.price ?? null,
  stock: typeof item?.stock === "number" ? item.stock : 0,
  type: item?.type ? String(item.type) : null,
  branchId: item?.branchId ? String(item.branchId) : null,
  image: item?.image ? String(item.image) : null,
});

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const findItemByCode = async (code: string) => {
  const normalizedCode = String(code).trim();

  if (!normalizedCode) {
    return null;
  }

  // 1. Try DB for newly registered Barcode records
  if (isDbConnected()) {
    const dbBarcode = await Barcode.findOne({
      $or: [
        { barcode: normalizedCode },
        { qrCode: normalizedCode },
        { itemId: normalizedCode },
        { barcodeId: normalizedCode }
      ]
    }).lean();

    if (dbBarcode) {
      return {
        _id: String(dbBarcode._id),
        sku: dbBarcode.itemId,
        name: dbBarcode.itemName,
        barcode: dbBarcode.barcode,
        tag: dbBarcode.certificateNumber || "",
        purity: dbBarcode.purity,
        weight: dbBarcode.weight,
        price: (dbBarcode as any).price || null,
        stock: 1,
        type: "Ring",
        branchId: "MAIN",
        image: null
      };
    }
  }

  // 2. Always check mockRetailerBarcodes (covers offline-created items even when DB is connected)
  const fbBarcode = mockRetailerBarcodes.find((b: any) =>
    String(b.barcode) === normalizedCode ||
    String(b.qrCode) === normalizedCode ||
    String(b.itemId) === normalizedCode ||
    String(b.barcodeId) === normalizedCode
  );

  if (fbBarcode) {
    return {
      _id: fbBarcode._id || null,
      sku: fbBarcode.itemId,
      name: fbBarcode.itemName,
      barcode: fbBarcode.barcode,
      tag: fbBarcode.certificateNumber || "",
      purity: fbBarcode.purity,
      weight: fbBarcode.weight,
      price: fbBarcode.price || null,
      stock: 1,
      type: "Ring",
      branchId: "MAIN",
      image: null
    };
  }

  // 3. Try DB or Mock for standard Inventory items
  if (isDbConnected()) {
    // Only include _id in the $or when normalizedCode looks like a valid MongoDB ObjectId.
    // Otherwise Mongoose throws a CastError for plain barcode strings like "8901234567890".
    const isObjectId = /^[a-f\d]{24}$/i.test(normalizedCode);
    const dbItem = await Inventory.findOne({
      $or: [
        { barcode: normalizedCode },
        { tag: normalizedCode },
        { sku: normalizedCode },
        ...(isObjectId ? [{ _id: normalizedCode }] : []),
      ],
    }).lean();

    if (dbItem) {
      return normalizeItem(dbItem);
    }
  }

  const fallbackItem = mockInventory.find((item: any) => {
    const searchableValues = [
      item?._id,
      item?.sku,
      item?.barcode,
      item?.tag,
      item?.name,
    ]
      .filter(Boolean)
      .map((value) => String(value));

    return searchableValues.includes(normalizedCode);
  });

  if (!fallbackItem) {
    return null;
  }

  return normalizeItem(fallbackItem);
};


export const getBarcodeDetails = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "A barcode or lookup code is required",
      });
    }

    const item = await findItemByCode(code);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found for the provided code",
      });
    }

    return res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Barcode lookup error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to lookup barcode details",
    });
  }
};

export const createBarcode = async (req: Request, res: Response) => {
  try {
    const payload = {
      barcodeId: normalizeString(req.body.barcodeId) || generateId("RET-BC"),
      itemId: normalizeString(req.body.itemId) || generateId("RET-ITEM"),
      itemName: normalizeString(req.body.itemName),
      barcode: normalizeString(req.body.barcode) || generateId("RET"),
      qrCode: normalizeString(req.body.qrCode) || generateId("RET-QR"),
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
      mockRetailerBarcodes.push(record);
      return res.status(201).json({ success: true, data: record, message: "Retailer barcode saved (offline)" });
    }

    const record = new Barcode(payload);
    await record.save();
    return res.status(201).json({ success: true, data: record, message: "Retailer barcode saved" });
  } catch (error) {
    console.error("Failed to save retailer barcode:", error);
    return res.status(500).json({ success: false, error: "Failed to save retailer barcode" });
  }
};

export const getRetailerBarcodes = async (req: Request, res: Response) => {
  try {
    const search = normalizeString(req.query.q || req.query.barcode || "");
    
    if (!isDbConnected()) {
      let items = mockRetailerBarcodes;
      if (search) {
        items = mockRetailerBarcodes.filter((item: any) => 
          String(item.barcode).toLowerCase().includes(search.toLowerCase()) ||
          String(item.qrCode).toLowerCase().includes(search.toLowerCase()) ||
          String(item.itemName).toLowerCase().includes(search.toLowerCase()) ||
          String(item.itemId).toLowerCase().includes(search.toLowerCase())
        );
      }
      return res.json({ success: true, data: items });
    }

    const filter = search ? { $or: [{ barcode: search }, { qrCode: search }, { itemName: search }, { itemId: search }] } : {};
    const items = await Barcode.find(filter).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error("Failed to fetch retailer barcodes:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch retailer barcodes" });
  }
};

export const createPrintJob = async (req: Request, res: Response) => {
  try {
    const { itemIds, labelTemplate } = req.body as {
      itemIds?: unknown;
      labelTemplate?: unknown;
    };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "itemIds must be a non-empty array",
      });
    }

    if (typeof labelTemplate !== "string" || labelTemplate.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "labelTemplate is required",
      });
    }

    const resolvedItems: BarcodeLookupItem[] = [];
    const missingItems: string[] = [];

    for (const rawItemId of itemIds) {
      const itemId = String(rawItemId).trim();

      if (!itemId) {
        missingItems.push(String(rawItemId));
        continue;
      }

      const item = await findItemByCode(itemId);

      if (!item) {
        missingItems.push(itemId);
        continue;
      }

      resolvedItems.push(item);
    }

    if (missingItems.length > 0) {
      return res.status(404).json({
        success: false,
        error: "One or more items could not be found",
        missingItems,
      });
    }

    const printJob = {
      printJobId: `print-${Date.now()}`,
      labelTemplate,
      itemIds,
      generatedAt: new Date().toISOString(),
      layoutStream: resolvedItems.map((item) => ({
        itemId: item._id,
        labelTemplate,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        tag: item.tag,
        price: item.price,
        stock: item.stock,
      })),
    };

    return res.status(201).json({
      success: true,
      data: printJob,
    });
  } catch (error) {
    console.error("Print job creation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate print job",
    });
  }
};


