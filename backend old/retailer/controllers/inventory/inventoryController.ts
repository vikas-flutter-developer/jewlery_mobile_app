import { Request, Response } from "express";
import { Inventory, ConsignmentStock } from "../../models/index.js";
import { mockInventory } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { getAllFallbackConsignments, addFallbackConsignment, updateFallbackConsignment } from "../../../lib/fallbackStore.js";

type InventoryPayload = {
  sku: string;
  grossWeight: number;
  netWeight: number;
  purity: string;
  fineWeight: number;
  diamondWeight: number;
  huid: string;
  image?: string;
  branchId: string;
  hallmarkCertificate?: string;
  gemstoneCertificate?: string;
  gemstoneCertificateType?: string;
  condition?: string;
  isConsignment?: boolean;
  vendorId?: string;
  consignmentCommission?: number;
  diamondCarat?: number;
  diamondCut?: string;
  diamondColor?: string;
  diamondClarity?: string;
  diamondType?: string;
  name?: string;
  weight?: number;
  type?: string;
  price?: number;
};

type InventoryRecord = InventoryPayload & {
  _id?: string;
  barcode: string;
  tag: string;
  createdAt: string;
};

const barcodeRegistry = new Map<string, { branchId: string; barcode: string; tag: string; sku: string; id: string }>();

const sanitizeSku = (sku: string) =>
  sku
    .replace(/[^A-Z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

let barcodeSequence = 1;

const generateBarcode = () => `BAR${String(barcodeSequence++).padStart(3, "0")}`;

const getAllBarcodes = async () => {
  const barcodes = new Set<string>();

  for (const entry of barcodeRegistry.values()) {
    barcodes.add(entry.barcode);
  }

  if (!isDbConnected()) {
    for (const item of mockInventory as Array<any>) {
      if (item?.barcode) {
        barcodes.add(String(item.barcode));
      }
    }
    return barcodes;
  }

  const dbItems = await Inventory.find({ barcode: { $exists: true } }).select("barcode").lean();
  for (const item of dbItems) {
    if (item?.barcode) {
      barcodes.add(String(item.barcode));
    }
  }

  return barcodes;
};

const getBranchBarcodes = async (branchId: string) => {
  const barcodes = new Set<string>();

  for (const entry of barcodeRegistry.values()) {
    if (entry.branchId === branchId) {
      barcodes.add(entry.barcode);
    }
  }

  if (!isDbConnected()) {
    for (const item of mockInventory as Array<any>) {
      if (item?.branchId === branchId && item?.barcode) {
        barcodes.add(String(item.barcode));
      }
    }
    return Array.from(barcodes);
  }

  const dbItems = await Inventory.find({ branchId, barcode: { $exists: true } }).select("barcode").lean();
  for (const item of dbItems) {
    if (item?.barcode) {
      barcodes.add(String(item.barcode));
    }
  }

  return Array.from(barcodes);
};

const buildRecord = (payload: InventoryPayload, barcode: string, tag: string): InventoryRecord => ({
  ...payload,
  barcode,
  tag,
  createdAt: new Date().toISOString(),
});

const parseInventoryPayload = (req: Request): InventoryPayload => {
  let {
    sku,
    grossWeight,
    netWeight,
    purity,
    fineWeight,
    diamondWeight,
    huid,
    image,
    branchId,
    hallmarkCertificate,
    gemstoneCertificate,
    gemstoneCertificateType,
    condition,
    isConsignment,
    vendorId,
    consignmentCommission,
    diamondCarat,
    diamondCut,
    diamondColor,
    diamondClarity,
    diamondType,
    name,
    weight,
    type,
    price
  } = req.body;

  // Smart fallbacks to prevent errors from frontends sending simpler objects (like MetalInventory.tsx)
  if (!sku) {
    sku = `SKU-${type || "ASSET"}-${Date.now()}`;
  }
  if (!branchId) {
    branchId = "MAIN";
  }
  if (!purity) {
    purity = "N/A";
  }
  if (!huid) {
    huid = "N/A";
  }

  const actualWeight = Number(weight ?? 0);
  const parsedGrossWeight = Number(grossWeight ?? actualWeight);
  const parsedNetWeight = Number(netWeight ?? actualWeight);
  const parsedFineWeight = Number(fineWeight ?? (actualWeight * 0.9));
  const parsedDiamondWeight = Number(diamondWeight ?? (type === "DIAMOND" ? actualWeight : 0));

  if ([parsedGrossWeight, parsedNetWeight, parsedFineWeight, parsedDiamondWeight].some((value) => Number.isNaN(value))) {
    throw new Error("grossWeight, netWeight, fineWeight, and diamondWeight must be numeric");
  }

  return {
    sku: String(sku),
    grossWeight: parsedGrossWeight,
    netWeight: parsedNetWeight,
    purity: String(purity),
    fineWeight: parsedFineWeight,
    diamondWeight: parsedDiamondWeight,
    huid: String(huid),
    image: image ? String(image) : undefined,
    branchId: String(branchId),
    hallmarkCertificate: hallmarkCertificate ? String(hallmarkCertificate) : undefined,
    gemstoneCertificate: gemstoneCertificate ? String(gemstoneCertificate) : undefined,
    gemstoneCertificateType: gemstoneCertificateType ? String(gemstoneCertificateType) : undefined,
    condition: condition ? String(condition) : undefined,
    isConsignment: isConsignment !== undefined ? Boolean(isConsignment) : undefined,
    vendorId: vendorId ? String(vendorId) : undefined,
    consignmentCommission: consignmentCommission !== undefined ? Number(consignmentCommission) : undefined,
    diamondCarat: diamondCarat !== undefined ? Number(diamondCarat) : undefined,
    diamondCut: diamondCut ? String(diamondCut) : undefined,
    diamondColor: diamondColor ? String(diamondColor) : undefined,
    diamondClarity: diamondClarity ? String(diamondClarity) : undefined,
    diamondType: diamondType ? String(diamondType) : undefined,
    name: name ? String(name) : undefined,
    weight: actualWeight,
    type: type ? String(type) : undefined,
    price: price !== undefined ? Number(price) : undefined,
  };
};

export const getInventory = async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) return res.json(mockInventory);

    const { inventorySearchService } = await import("../../services/catalogue/inventorySearchService.js");
    const { normalizeInventoryListItem } = await import("../../services/catalogue/catalogueAuditService.js");
    const filters = inventorySearchService.parseQuery(req.query as Record<string, unknown>);

    if (inventorySearchService.hasSearchParams(filters)) {
      const result = await inventorySearchService.search(filters);
      return res.json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    }

    const items = await Inventory.find().lean();
    res.json(items.map(normalizeInventoryListItem));
  } catch (error) {
    console.error("Fetch inventory error:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};

export const createInventory = async (req: Request, res: Response) => {
  try {
    const payload = parseInventoryPayload(req);
    const existingBarcodes = await getAllBarcodes();

    let barcode = generateBarcode();
    while (existingBarcodes.has(barcode)) {
      barcode = generateBarcode();
    }

    const tag = `TAG-${sanitizeSku(payload.sku)}-${barcode}`;
    const record = buildRecord(payload, barcode, tag);

    barcodeRegistry.set(barcode, {
      branchId: payload.branchId,
      barcode,
      tag,
      sku: payload.sku,
      id: record._id || barcode,
    });

    if (!isDbConnected()) {
      const newItem = { ...record, _id: `mock_inv_${Date.now()}` };
      mockInventory.push(newItem as any);
      return res.status(201).json(newItem);
    }

    const newItem = new Inventory(record);
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error: any) {
    console.error("Save inventory error:", error);
    res.status(400).json({ error: error.message || "Failed to add item" });
  }
};

export const reconcileInventory = async (req: Request, res: Response) => {
  try {
    const { scannedBarcodes, branchId } = req.body;

    if (!Array.isArray(scannedBarcodes) || !branchId) {
      return res.status(400).json({ error: "scannedBarcodes array and branchId are required" });
    }

    const branchBarcodes = await getBranchBarcodes(String(branchId));
    const normalizedScans = scannedBarcodes.map((item: unknown) => String(item));

    const matched = normalizedScans.filter((barcode) => branchBarcodes.includes(barcode)).length;
    const missing = normalizedScans.filter((barcode) => !branchBarcodes.includes(barcode));
    const extra = branchBarcodes.filter((barcode) => !normalizedScans.includes(barcode));

    return res.json({ matched, missing, extra });
  } catch (error) {
    console.error("Reconcile inventory error:", error);
    res.status(500).json({ error: "Failed to reconcile inventory" });
  }
};

export const updateInventory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      hallmarkCertificate,
      gemstoneCertificate,
      gemstoneCertificateType,
      image,
      condition,
      isConsignment,
      vendorId,
      consignmentCommission
    } = req.body;
    
    if (!isDbConnected()) {
      const item = (mockInventory as any[]).find(i => i._id === id || i.barcode === id || i.sku === id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      if (hallmarkCertificate !== undefined) item.hallmarkCertificate = hallmarkCertificate;
      if (gemstoneCertificate !== undefined) item.gemstoneCertificate = gemstoneCertificate;
      if (gemstoneCertificateType !== undefined) item.gemstoneCertificateType = gemstoneCertificateType;
      if (image !== undefined) item.image = image;
      if (condition !== undefined) item.condition = condition;
      if (isConsignment !== undefined) item.isConsignment = isConsignment;
      if (vendorId !== undefined) item.vendorId = vendorId;
      if (consignmentCommission !== undefined) item.consignmentCommission = consignmentCommission;
      return res.json({ success: true, data: item });
    }

    const updates: any = {};
    if (hallmarkCertificate !== undefined) updates.hallmarkCertificate = hallmarkCertificate;
    if (gemstoneCertificate !== undefined) updates.gemstoneCertificate = gemstoneCertificate;
    if (gemstoneCertificateType !== undefined) updates.gemstoneCertificateType = gemstoneCertificateType;
    if (image !== undefined) updates.image = image;
    if (condition !== undefined) updates.condition = condition;
    if (isConsignment !== undefined) updates.isConsignment = isConsignment;
    if (vendorId !== undefined) updates.vendorId = vendorId;
    if (consignmentCommission !== undefined) updates.consignmentCommission = consignmentCommission;

    const item = await Inventory.findOneAndUpdate(
      { $or: [{ _id: id }, { barcode: id }, { sku: id }] } as any,
      updates,
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    return res.json({ success: true, data: item });
  } catch (error: any) {
    console.error("Update inventory error:", error);
    res.status(500).json({ error: error.message || "Failed to update item" });
  }
};

export const getConsignmentStock = async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      const items = await ConsignmentStock.find({}).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: items });
    } else {
      const items = await getAllFallbackConsignments();
      return res.json({ success: true, data: items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
    }
  } catch (error: any) {
    console.error("Failed to load consignment stock", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to load consignment stock" });
  }
};

export const createConsignmentStock = async (req: Request, res: Response) => {
  try {
    const { consignmentCode, consignorName, itemDescription, metalType, weight, purity, price, commissionRate, status } = req.body;
    if (!consignmentCode || !consignorName || !itemDescription || !metalType || weight == null || !purity || price == null) {
      return res.status(400).json({ success: false, error: "Missing required consignment fields" });
    }

    const payload = {
      _id: `CNS-${Date.now()}`,
      consignmentCode,
      consignorName,
      itemDescription,
      metalType,
      weight: Number(weight),
      purity,
      price: Number(price),
      commissionRate: Number(commissionRate ?? 10),
      status: status || "AVAILABLE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      const saved = await ConsignmentStock.create(payload);
      return res.status(201).json({ success: true, data: saved });
    } else {
      const saved = await addFallbackConsignment(payload);
      return res.status(201).json({ success: true, data: saved });
    }
  } catch (error: any) {
    console.error("Failed to add consignment stock", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to add consignment stock" });
  }
};

export const updateConsignmentStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (isDbConnected()) {
      const updated = await ConsignmentStock.findOneAndUpdate(
        { $or: [{ _id: id }, { consignmentCode: id }] },
        { 
          $set: { 
            ...updates,
            updatedAt: new Date()
          } 
        },
        { new: true }
      );
      if (!updated) return res.status(404).json({ success: false, error: "Consignment item not found" });
      return res.json({ success: true, data: updated });
    } else {
      const list = await getAllFallbackConsignments();
      const item = list.find((c: any) => c._id === id || c.consignmentCode === id);
      if (!item) return res.status(404).json({ success: false, error: "Consignment item not found" });
      
      Object.assign(item, updates);
      item.updatedAt = new Date().toISOString();
      await updateFallbackConsignment(item);
      return res.json({ success: true, data: item });
    }
  } catch (error: any) {
    console.error("Failed to update consignment stock", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update consignment stock" });
  }
};


