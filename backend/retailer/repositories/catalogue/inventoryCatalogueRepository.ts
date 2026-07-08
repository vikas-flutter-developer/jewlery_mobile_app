import { ClientSession } from "mongoose";
import {
  Inventory,
  Branch,
  Vendor,
  ImportHistory,
  BarcodePrintHistory,
} from "../../models/index.js";

export type InventorySearchFilters = {
  q?: string;
  sku?: string;
  barcode?: string;
  rfid?: string;
  name?: string;
  vendorId?: string;
  category?: string;
  metal?: string;
  purity?: string;
  hallmarkNumber?: string;
  branchId?: string;
  page?: number;
  limit?: number;
};

export const inventoryCatalogueRepository = {
  findBySkuId(skuId: string, session?: ClientSession | null) {
    const isObjectId = /^[a-f\d]{24}$/i.test(skuId);
    const filter = {
      $or: [{ sku: skuId }, { barcode: skuId }, ...(isObjectId ? [{ _id: skuId }] : [])],
    };
    const query = Inventory.findOne(filter);
    if (session) query.session(session);
    return query;
  },

  async search(filters: InventorySearchFilters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
    const skip = (page - 1) * limit;

    const andConditions: Record<string, unknown>[] = [];

    if (filters.q) {
      const regex = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andConditions.push({
        $or: [
          { sku: regex },
          { barcode: regex },
          { rfid: regex },
          { name: regex },
          { hallmarkNumber: regex },
          { tag: regex },
        ],
      });
    }

    const exactFields: Array<[keyof InventorySearchFilters, string]> = [
      ["sku", "sku"],
      ["barcode", "barcode"],
      ["rfid", "rfid"],
      ["name", "name"],
      ["vendorId", "vendorId"],
      ["category", "category"],
      ["metal", "metal"],
      ["purity", "purity"],
      ["hallmarkNumber", "hallmarkNumber"],
      ["branchId", "branchId"],
    ];

    for (const [filterKey, dbField] of exactFields) {
      const value = filters[filterKey];
      if (value) {
        andConditions.push({ [dbField]: new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
      }
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    const [items, total] = await Promise.all([
      Inventory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Inventory.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  },

  async findExistingIdentifiers() {
    const items = await Inventory.find({})
      .select("sku barcode rfid tag")
      .lean();
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    const rfids = new Set<string>();
    for (const item of items) {
      if (item.sku) skus.add(String(item.sku).toUpperCase());
      if (item.barcode) barcodes.add(String(item.barcode));
      if (item.rfid) rfids.add(String(item.rfid));
    }
    return { skus, barcodes, rfids };
  },

  async bulkWrite(operations: any[], session?: ClientSession | null) {
    const options: any = { ordered: false };
    if (session) options.session = session;
    return Inventory.bulkWrite(operations, options);
  },

  async findByFilter(criteria: {
    skuIds?: string[];
    category?: string;
    vendorId?: string;
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const filter: Record<string, unknown> = {};

    if (criteria.skuIds?.length) {
      filter.$or = [
        { _id: { $in: criteria.skuIds.filter((id) => /^[a-f\d]{24}$/i.test(id)) } },
        { sku: { $in: criteria.skuIds } },
        { barcode: { $in: criteria.skuIds } },
      ];
    }
    if (criteria.category) filter.category = new RegExp(`^${criteria.category}$`, "i");
    if (criteria.vendorId) filter.vendorId = criteria.vendorId;
    if (criteria.branchId) filter.branchId = criteria.branchId;
    if (criteria.dateFrom || criteria.dateTo) {
      filter.createdAt = {};
      if (criteria.dateFrom) (filter.createdAt as any).$gte = criteria.dateFrom;
      if (criteria.dateTo) (filter.createdAt as any).$lte = criteria.dateTo;
    }

    return Inventory.find(filter).lean();
  },

  async getBranchMap() {
    const branches = await Branch.find({ status: "ACTIVE" }).select("_id code name").lean();
    const byCode = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const branch of branches) {
      if (branch.code) byCode.set(String(branch.code).toUpperCase(), String(branch.code));
      if (branch.name) byName.set(String(branch.name).toUpperCase(), String(branch.code));
      if (branch._id) {
        byCode.set(String(branch._id), String(branch.code));
      }
    }
    return { byCode, byName, branches };
  },

  async getVendorMap() {
    const vendors = await Vendor.find({ status: "ACTIVE" }).select("_id name").lean();
    const byName = new Map<string, string>();
    const byId = new Map<string, string>();
    for (const vendor of vendors) {
      const id = String(vendor._id);
      byId.set(id, id);
      if (vendor.name) byName.set(String(vendor.name).toUpperCase(), id);
    }
    return { byName, byId, vendors };
  },
};

export const importHistoryRepository = {
  create(data: Record<string, unknown>, session?: ClientSession | null) {
    if (session) return ImportHistory.create([data], { session }).then((docs) => docs[0]);
    return ImportHistory.create(data);
  },

  update(importId: string, data: Record<string, unknown>, session?: ClientSession | null) {
    const query = ImportHistory.findOneAndUpdate({ importId }, { $set: data }, { new: true });
    if (session) query.session(session);
    return query.lean();
  },

  findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return Promise.all([
      ImportHistory.find({}).sort({ uploadDate: -1 }).skip(skip).limit(limit).lean(),
      ImportHistory.countDocuments({}),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  },

  findByImportId(importId: string) {
    return ImportHistory.findOne({ importId }).lean();
  },
};

export const barcodePrintHistoryRepository = {
  create(data: Record<string, unknown>, session?: ClientSession | null) {
    if (session) return BarcodePrintHistory.create([data], { session }).then((docs) => docs[0]);
    return BarcodePrintHistory.create(data);
  },

  findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return Promise.all([
      BarcodePrintHistory.find({}).sort({ printDate: -1 }).skip(skip).limit(limit).lean(),
      BarcodePrintHistory.countDocuments({}),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  },
};
