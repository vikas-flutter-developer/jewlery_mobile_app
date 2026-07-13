import { Request, Response } from "express";
import { RetailerOrder } from "../../../retailer/models/index.js";
import Karikar from "../../../models/Karikar.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockKarikars } from "../../../data/mockData.js";
import {
  getAllFallbackRetailerOrders,
  addFallbackRetailerOrder,
  updateFallbackRetailerOrder
} from "../../../lib/fallbackStore.js";
import { readPlatformStore } from "../../../lib/platformStore.js";
import { AuthRequest } from "../../../lib/authUtils.js";

const SYSTEM_MFR_ID = "shop-1779518126045-txlhr";

export const getRetailerOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.query;
    const authUser = req.user;
    let filter: any = {};

    if (authUser) {
      const tenantId = authUser.tenantId;
      const role = authUser.role;
      const storeType = authUser.storeType;

      if (role === "RETAILER" || storeType === "RETAILER") {
        if (tenantId && tenantId !== "default-shop") {
          filter.retailerId = tenantId;
        } else if (email) {
          filter.retailerEmail = String(email);
        }
      } else if (role === "ADMIN" || storeType === "MANUFACTURER") {
        const mfrId = tenantId || SYSTEM_MFR_ID;
        const isNewMfr = mfrId && mfrId !== "default-shop" && mfrId !== SYSTEM_MFR_ID;
        if (isNewMfr) {
          filter.manufacturerId = mfrId;
        } else {
          filter.manufacturerId = { $in: [mfrId, SYSTEM_MFR_ID, null, ""] };
        }
      } else if (email) {
        filter.retailerEmail = String(email);
      }
    } else if (email) {
      filter.retailerEmail = String(email);
    }

    if (isDbConnected()) {
      const orders = await RetailerOrder.find(filter).sort({ createdAt: -1 });
      return res.json({ success: true, data: orders });
    } else {
      const allOrders = await getAllFallbackRetailerOrders();
      let filtered = allOrders;

      if (filter.retailerId) {
        filtered = filtered.filter(o => o.retailerId === filter.retailerId);
      } else if (filter.retailerEmail) {
        filtered = filtered.filter(o => o.retailerEmail === filter.retailerEmail);
      }

      if (filter.manufacturerId) {
        if (filter.manufacturerId.$in && Array.isArray(filter.manufacturerId.$in)) {
          const allowed = new Set(filter.manufacturerId.$in);
          filtered = filtered.filter(o => !o.manufacturerId || allowed.has(o.manufacturerId));
        } else {
          filtered = filtered.filter(o => o.manufacturerId === filter.manufacturerId);
        }
      }

      const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ success: true, data: sorted });
    }
  } catch (error: any) {
    console.error("Failed to fetch retailer orders:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createRetailerOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { retailerId, retailerEmail, manufacturerId, manufacturerName, itemType, purity, weight, quantity, diamondCarat, diamondCut, diamondClarity, diamondColor, notes } = req.body;
    
    // Security check: Force user's authenticated tenant credentials
    const authUser = req.user;
    let finalRetailerId = retailerId;
    let finalRetailerEmail = retailerEmail;

    if (authUser && (authUser.role === "RETAILER" || authUser.storeType === "RETAILER")) {
      if (authUser.tenantId && authUser.tenantId !== "default-shop") {
        finalRetailerId = authUser.tenantId;
        finalRetailerEmail = authUser.email;
      }
    }

    if (!finalRetailerId || !finalRetailerEmail || !manufacturerId || !manufacturerName || !itemType || !purity || !weight) {
      return res.status(400).json({ success: false, error: "Missing required order fields" });
    }

    const payload = {
      retailerId: finalRetailerId,
      retailerEmail: finalRetailerEmail,
      manufacturerId,
      manufacturerName,
      itemType,
      purity,
      weight: Number(weight),
      quantity: Number(quantity || 1),
      diamondCarat: diamondCarat ? Number(diamondCarat) : undefined,
      diamondCut,
      diamondClarity,
      diamondColor,
      notes,
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      const order = new RetailerOrder(payload);
      await order.save();
      return res.status(201).json({ success: true, data: order });
    } else {
      const order = {
        ...payload,
        _id: `RO-${Date.now()}`
      };
      await addFallbackRetailerOrder(order);
      return res.status(201).json({ success: true, data: order });
    }
  } catch (error: any) {
    console.error("Failed to create retailer order:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateRetailerOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, karikarId, karikarName, issuedGrossWeight, issuedAlloy, dueDate } = req.body;

    if (isDbConnected()) {
      const updates: any = { updatedAt: new Date() };
      if (status) updates.status = status;
      if (karikarId !== undefined) updates.karikarId = karikarId;
      if (karikarName !== undefined) updates.karikarName = karikarName;

      const order = await RetailerOrder.findByIdAndUpdate(id, { $set: updates }, { new: true });
      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      // If assigned to a karikar, we can also link it to the Karikar's job cards or status
      if (karikarId && status === "In Production") {
        const grossWeight = issuedGrossWeight !== undefined ? Number(issuedGrossWeight) : order.weight;
        const alloy = issuedAlloy !== undefined ? Number(issuedAlloy) : 0;
        const netGoldWeight = Math.max(0, grossWeight - alloy);
        const deadline = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const jobCard = {
          _id: `JC-${Date.now()}`,
          orderId: order._id.toString(),
          issuedGrossWeight: grossWeight,
          issuedAlloy: alloy,
          issuedGoldWeight: netGoldWeight,
          issuedPurity: order.purity,
          issuedStones: order.diamondCarat ? [{ stoneId: "Diamond", carat: order.diamondCarat }] : [],
          dueDate: deadline,
          status: "OPEN",
          issuedAt: new Date().toISOString()
        };

        await Karikar.findByIdAndUpdate(karikarId, {
          $push: { jobCards: jobCard },
          $set: {
            assignedWork: order._id.toString(),
            status: "ACTIVE"
          },
          $inc: { goldStock: netGoldWeight }
        });
      }

      return res.json({ success: true, data: order });
    } else {
      const allOrders = await getAllFallbackRetailerOrders();
      const order = allOrders.find(o => o._id === id);
      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      if (status) order.status = status;
      if (karikarId !== undefined) order.karikarId = karikarId;
      if (karikarName !== undefined) order.karikarName = karikarName;
      order.updatedAt = new Date().toISOString();

      await updateFallbackRetailerOrder(order);

      // If assigned to a karikar in offline mode
      if (karikarId && status === "In Production") {
        const mockK = mockKarikars.find((k: any) => k._id === karikarId);
        if (mockK) {
          const grossWeight = issuedGrossWeight !== undefined ? Number(issuedGrossWeight) : order.weight;
          const alloy = issuedAlloy !== undefined ? Number(issuedAlloy) : 0;
          const netGoldWeight = Math.max(0, grossWeight - alloy);
          const deadline = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          mockK.jobCards = mockK.jobCards || [];
          mockK.jobCards.push({
            _id: `JC-${Date.now()}`,
            orderId: order._id.toString(),
            issuedGrossWeight: grossWeight,
            issuedAlloy: alloy,
            issuedGoldWeight: netGoldWeight,
            issuedPurity: order.purity,
            issuedStones: order.diamondCarat ? [{ stoneId: "Diamond", carat: order.diamondCarat }] : [],
            dueDate: deadline,
            status: "OPEN",
            issuedAt: new Date().toISOString()
          });
          mockK.assignedWork = order._id.toString();
          mockK.status = "ACTIVE";
          mockK.goldStock = Number(mockK.goldStock || 0) + netGoldWeight;
        }
      }

      return res.json({ success: true, data: order });
    }
  } catch (error: any) {
    console.error("Failed to update retailer order:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getManufacturersList = async (req: Request, res: Response) => {
  try {
    const platform = await readPlatformStore();
    const platformManufacturers = platform.stores
      .filter((s: any) => s.storeType === "MANUFACTURER")
      .map((s: any) => ({
        id: s.id,
        shopName: s.shopName,
        email: s.email,
        phone: s.phone
      }));

    // Always prepend the System Manufacturer (default fallback) entry first
    const SYSTEM_MFR_ID = "shop-1779518126045-txlhr";
    const systemMfr = {
      id: SYSTEM_MFR_ID,
      shopName: "System Manufacturer",
      email: "manufacturer@aurajewel.com",
      phone: "9999999999"
    };

    // Remove any duplicate with same id before prepending
    const others = platformManufacturers.filter((m: any) => m.id !== SYSTEM_MFR_ID);
    const manufacturers = [systemMfr, ...others];

    return res.json({ success: true, data: manufacturers });
  } catch (error: any) {
    console.error("Failed to get manufacturers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


