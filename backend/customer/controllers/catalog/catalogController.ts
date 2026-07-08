import { Request, Response } from "express";
import { Design, Wishlist, Inventory } from "../../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockDesigns, mockWishlists, mockInventory } from "../../../data/mockData.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

// ================= DESIGN REGISTRY SYSTEM (Feature 104) =================

export const getDesigns = async (req: Request, res: Response) => {
  try {
    let list: any[];
    if (isDbConnected()) {
      list = await Design.find({}).lean();
    } else {
      list = mockDesigns;
    }
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Failed to fetch designs", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch designs" });
  }
};

export const createDesign = async (req: Request, res: Response) => {
  try {
    const { designCode, name, category, metalType, standardPurity, image, minStockThreshold, description, units } = req.body;

    const parsedCode = normalizeString(designCode).toUpperCase();
    const parsedName = normalizeString(name);
    const parsedCategory = normalizeString(category);
    const parsedMetalType = normalizeString(metalType).toUpperCase();
    const parsedPurity = normalizeString(standardPurity);
    const parsedMinStock = toPositiveNumber(minStockThreshold, 2);
    const parsedUnits = Number(units) || 0;

    if (!parsedCode || !parsedName || !parsedCategory || !parsedMetalType || !parsedPurity) {
      return res.status(400).json({
        success: false,
        error: "designCode, name, category, metalType, and standardPurity are required",
      });
    }

    const designData = {
      designCode: parsedCode,
      name: parsedName,
      category: parsedCategory,
      metalType: parsedMetalType,
      standardPurity: parsedPurity,
      image: normalizeString(image),
      minStockThreshold: parsedMinStock,
      description: normalizeString(description),
      units: parsedUnits,
      createdAt: new Date().toISOString()
    };

    let created: any;
    if (isDbConnected()) {
      created = await Design.create(designData);
    } else {
      created = { _id: `design_${Date.now()}`, ...designData };
      mockDesigns.push(created);
    }

    return res.status(201).json({
      success: true,
      message: "Design archetype created successfully",
      data: created,
    });
  } catch (error: any) {
    console.error("Failed to create design", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create design" });
  }
};

// ================= WISHLIST SYSTEM (Feature 109) =================

export const getWishlists = async (req: Request, res: Response) => {
  try {
    let list: any[];
    if (isDbConnected()) {
      list = await Wishlist.find({}).lean();
    } else {
      list = mockWishlists;
    }
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("Failed to fetch wishlists", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch wishlists" });
  }
};

export const addToWishlist = async (req: Request, res: Response) => {
  try {
    const { customerName, customerPhone, designCode, name, category } = req.body;

    const parsedCustomerName = normalizeString(customerName, "Walk-in");
    const parsedCustomerPhone = normalizeString(customerPhone);
    const parsedDesignCode = normalizeString(designCode);
    const parsedDesignName = normalizeString(name);

    if (!parsedCustomerPhone || !parsedDesignCode || !parsedDesignName) {
      return res.status(400).json({
        success: false,
        error: "customerPhone, designCode, and name are required",
      });
    }

    let wishlist: any;
    if (isDbConnected()) {
      wishlist = await Wishlist.findOne({ customerPhone: parsedCustomerPhone });
    } else {
      wishlist = mockWishlists.find(w => w.customerPhone === parsedCustomerPhone);
    }

    const newItem = {
      designCode: parsedDesignCode,
      name: parsedDesignName,
      category: normalizeString(category, "General"),
      addedAt: new Date().toISOString()
    };

    if (wishlist) {
      wishlist.items.push(newItem);
      if (isDbConnected()) {
        await wishlist.save();
      }
    } else {
      const wishlistData = {
        customerId: `w_${Date.now()}`,
        customerName: parsedCustomerName,
        customerPhone: parsedCustomerPhone,
        items: [newItem],
        createdAt: new Date().toISOString()
      };
      if (isDbConnected()) {
        wishlist = await Wishlist.create(wishlistData);
      } else {
        wishlist = { _id: `wish_${Date.now()}`, ...wishlistData };
        mockWishlists.push(wishlist);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Item added to customer wishlist successfully",
      data: wishlist,
    });
  } catch (error: any) {
    console.error("Failed to add to wishlist", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to add to wishlist" });
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // customerPhone or wishlist id
    const designCode = normalizeString(req.body?.designCode || req.query?.designCode);

    if (!designCode) {
      return res.status(400).json({
        success: false,
        error: "designCode is required to remove from wishlist",
      });
    }

    let wishlist: any;
    if (isDbConnected()) {
      wishlist = await Wishlist.findOne({ $or: [{ _id: id }, { customerPhone: id }] });
    } else {
      wishlist = mockWishlists.find(w => w._id === id || w.customerPhone === id);
    }

    if (!wishlist) {
      return res.status(404).json({ success: false, error: "Wishlist not found" });
    }

    wishlist.items = wishlist.items.filter((i: any) => i.designCode !== designCode);
    
    if (isDbConnected()) {
      await wishlist.save();
    }

    return res.json({
      success: true,
      message: "Item removed from wishlist successfully",
      data: wishlist
    });
  } catch (error: any) {
    console.error("Failed to remove from wishlist", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to remove from wishlist" });
  }
};

// ================= SHOWCASE / TRAY MANAGEMENT (Feature 108) =================

export const updateItemLocation = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    const { showcase, tray } = req.body;

    const parsedShowcase = normalizeString(showcase, "HQ Vault");
    const parsedTray = normalizeString(tray, "Main Tray");

    if (isDbConnected()) {
      const item = await Inventory.findOneAndUpdate(
        { barcode },
        { $set: { showcase: parsedShowcase, tray: parsedTray } },
        { new: true }
      );
      if (!item) {
        return res.status(404).json({ success: false, error: `Inventory item ${barcode} not found` });
      }
      return res.json({ success: true, message: "Physical tray location updated successfully", data: item });
    } else {
      const item = mockInventory.find(i => i.barcode === barcode);
      if (!item) {
        return res.status(404).json({ success: false, error: `Inventory item ${barcode} not found` });
      }
      item.showcase = parsedShowcase;
      item.tray = parsedTray;
      return res.json({ success: true, message: "Physical tray location updated successfully", data: item });
    }
  } catch (error: any) {
    console.error("Failed to update location", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update location" });
  }
};

// ================= ANALYTICS REPORTS (Features 105, 106, 107) =================

// Feature 105: Low Stock Alerts
export const getLowStockAlerts = async (req: Request, res: Response) => {
  try {
    let allDesigns: any[];
    let allInStockItems: any[];

    if (isDbConnected()) {
      allDesigns = await Design.find({}).lean();
      allInStockItems = await Inventory.find({ status: "In Stock" }).lean();
    } else {
      allDesigns = mockDesigns;
      allInStockItems = mockInventory.filter(i => i.status === "In Stock");
    }

    const alerts = [];
    for (const design of allDesigns) {
      const count = (design.units || 0) + allInStockItems.filter(i => i.designCode === design.designCode).length;
      if (count < design.minStockThreshold) {
        alerts.push({
          designCode: design.designCode,
          name: design.name,
          category: design.category,
          minThreshold: design.minStockThreshold,
          currentStock: count,
          severity: count === 0 ? "CRITICAL" : "WARNING"
        });
      }
    }

    return res.json({ success: true, data: alerts });
  } catch (error: any) {
    console.error("Failed to calculate stock alerts", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to calculate stock alerts" });
  }
};

// Feature 106: Dead Stock Report (older than 90 days)
export const getDeadStockReport = async (req: Request, res: Response) => {
  try {
    let allInStockItems: any[];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    if (isDbConnected()) {
      allInStockItems = await Inventory.find({
        status: "In Stock",
        inwardDate: { $lt: ninetyDaysAgo }
      }).lean();
    } else {
      allInStockItems = mockInventory.filter(i => {
        if (i.status !== "In Stock" || !i.inwardDate) return false;
        return new Date(i.inwardDate) < ninetyDaysAgo;
      });
    }

    const results = allInStockItems.map(item => {
      const inward = item.inwardDate ? new Date(item.inwardDate) : new Date(item.createdAt);
      const diffTime = Math.abs(Date.now() - inward.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        barcode: item.barcode || item._id,
        name: item.name,
        category: item.type,
        weight: item.weight,
        purity: item.purity,
        price: item.price,
        daysInStock: diffDays,
        showcase: item.showcase,
        tray: item.tray
      };
    });

    return res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Failed to generate dead stock report", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to generate dead stock report" });
  }
};

// Feature 107: Item Aging Report Per Category
export const getItemAgingReport = async (req: Request, res: Response) => {
  try {
    let allInStockItems: any[];

    if (isDbConnected()) {
      allInStockItems = await Inventory.find({ status: "In Stock" }).lean();
    } else {
      allInStockItems = mockInventory.filter(i => i.status === "In Stock");
    }

    const categories = Array.from(new Set(allInStockItems.map(i => i.type || "General")));
    const agingReport: Record<string, { "0-30 days": number; "31-60 days": number; "61-90 days": number; "91+ days": number; total: number }> = {};

    categories.forEach(cat => {
      agingReport[cat] = {
        "0-30 days": 0,
        "31-60 days": 0,
        "61-90 days": 0,
        "91+ days": 0,
        total: 0
      };
    });

    const now = Date.now();
    for (const item of allInStockItems) {
      const category = item.type || "General";
      const inward = item.inwardDate ? new Date(item.inwardDate) : new Date(item.createdAt);
      const diffTime = Math.abs(now - inward.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      agingReport[category].total += 1;
      if (diffDays <= 30) {
        agingReport[category]["0-30 days"] += 1;
      } else if (diffDays <= 60) {
        agingReport[category]["31-60 days"] += 1;
      } else if (diffDays <= 90) {
        agingReport[category]["61-90 days"] += 1;
      } else {
        agingReport[category]["91+ days"] += 1;
      }
    }

    return res.json({ success: true, data: agingReport });
  } catch (error: any) {
    console.error("Failed to generate aging report", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to generate aging report" });
  }
};

export const deleteDesign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (isDbConnected()) {
      const design = await Design.findByIdAndDelete(id);
      if (!design) {
        const designByCode = await Design.findOneAndDelete({ designCode: id });
        if (!designByCode) {
          return res.status(404).json({ success: false, error: "Design not found" });
        }
      }
    } else {
      const index = mockDesigns.findIndex(d => d._id === id || d.designCode === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Design not found" });
      }
      mockDesigns.splice(index, 1);
    }
    return res.json({ success: true, message: "Design successfully deleted" });
  } catch (error: any) {
    console.error("Failed to delete design", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to delete design" });
  }
};


