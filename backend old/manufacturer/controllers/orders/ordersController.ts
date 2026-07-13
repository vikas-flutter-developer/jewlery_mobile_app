import { Request, Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  ManufacturerOrder,
  ManufacturerSale,
  ManufacturerWholesaleOrder,
  ManufacturerKarikar,
} from "../../models/index.js";
// RetailerOrder is intentionally read from retailerDb so manufacturer sees orders placed by retailer
import { RetailerOrder as SharedRetailerOrder } from "../../../retailer/models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { mockSales, mockKarikars } from "../../../data/mockData.js";
import {
  getAllFallbackRetailerOrders,
  addFallbackRetailerOrder,
  updateFallbackRetailerOrder
} from "../../../lib/fallbackStore.js";
import { generateJobCard } from "../../../retailer/services/jobCardService.js";

const normalizeString = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const generateId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const respondError = (res: Response, error: any, fallback = "Server error") => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// ─── Orders ──────────────────────────────────────────────────────────────────

export const getManufacturerOrders = async (_req: Request, res: Response) => {
  try {
    const orders = await ManufacturerOrder.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: orders });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer orders");
  }
};

export const createManufacturerOrder = async (req: Request, res: Response) => {
  try {
    const order = new ManufacturerOrder({ ...req.body, createdAt: new Date() });
    await order.save();
    return res.status(201).json({ success: true, data: order, message: "Manufacturer order saved" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer order");
  }
};

// ─── Retailer Orders ──────────────────────────────────────────────────────────
// NOTE: These orders are placed BY retailers TO the manufacturer.
// We intentionally read from retailerDb (SharedRetailerOrder) so the manufacturer
// can see every order the retailer submits via their portal.

const SYSTEM_MFR_ID = "shop-1779518126045-txlhr";

export const getManufacturerRetailerOrders = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || SYSTEM_MFR_ID;
    const isNewTenant = tenantId && tenantId !== "default-shop" && tenantId !== SYSTEM_MFR_ID;

    if (!isDbConnected()) {
      const orders = await getAllFallbackRetailerOrders();
      const manufacturerIds = new Set(isNewTenant ? [tenantId] : [tenantId, SYSTEM_MFR_ID]);
      let filtered = orders.filter((o: any) =>
        isNewTenant ? o.manufacturerId === tenantId : (!o.manufacturerId || manufacturerIds.has(o.manufacturerId))
      );
      if (!isNewTenant && filtered.length === 0 && orders.length > 0) {
        // Fallback: show all orders since there's only one manufacturer in demo mode
        filtered = orders;
      }
      const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ success: true, data: sorted });
    }

    // DB mode: match by this manufacturer's tenantId OR the system default ID if not isolated new tenant
    const manufacturerIds = isNewTenant ? [tenantId] : [...new Set([tenantId, SYSTEM_MFR_ID])];
    const orders = await SharedRetailerOrder.find({
      manufacturerId: { $in: manufacturerIds }
    }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: orders });
  } catch (error) {
    return respondError(res, error, "Failed to load retailer orders");
  }
};

export const createManufacturerRetailerOrder = async (req: Request, res: Response) => {
  // Manufacturer can create an order on behalf of a retailer if needed
  try {
    if (!isDbConnected()) {
      const order = {
        ...req.body,
        _id: `RO-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await addFallbackRetailerOrder(order);
      return res.status(201).json({ success: true, data: order, message: "Retailer order created (offline)" });
    }
    const order = new SharedRetailerOrder({ ...req.body, createdAt: new Date() });
    await order.save();
    return res.status(201).json({ success: true, data: order, message: "Retailer order created" });
  } catch (error) {
    return respondError(res, error, "Failed to create retailer order");
  }
};

export const updateManufacturerRetailerOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, karikarId, karikarName, issuedGrossWeight, issuedAlloy, dueDate } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (karikarId !== undefined) updates.karikarId = karikarId;
    if (karikarName !== undefined) updates.karikarName = karikarName;

    if (!isDbConnected()) {
      const allOrders = await getAllFallbackRetailerOrders();
      const order = allOrders.find(o => o._id === id);
      if (!order) {
        return res.status(404).json({ success: false, error: "Retailer order not found" });
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

          // Auto-generate job card PDF on karikar assignment (non-blocking)
          const autoJobId = order._id?.toString();
          if (autoJobId) {
            generateJobCard(autoJobId, "system", { force: false }).catch((err: any) =>
              console.warn(`[JobCard] Auto-gen failed for ${autoJobId}:`, err?.message)
            );
          }
        }
      }

      return res.json({ success: true, data: order, message: "Order status updated (offline)" });
    }

    const order = await SharedRetailerOrder.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!order) {
      return res.status(404).json({ success: false, error: "Retailer order not found" });
    }

    // Link it to the Karikar's job cards or status if database is connected
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

      await ManufacturerKarikar.findByIdAndUpdate(karikarId, {
        $push: { jobCards: jobCard },
        $set: {
          assignedWork: order._id.toString(),
          status: "ACTIVE"
        },
        $inc: { goldStock: netGoldWeight }
      });

      // Auto-generate job card PDF on karikar assignment (non-blocking)
      const autoJobId = order._id?.toString();
      if (autoJobId) {
        generateJobCard(autoJobId, "system", { force: false }).catch((err: any) =>
          console.warn(`[JobCard] Auto-gen failed for ${autoJobId}:`, err?.message)
        );
      }
    }

    return res.json({ success: true, data: order, message: "Order status updated" });
  } catch (error) {
    return respondError(res, error, "Failed to update retailer order status");
  }
};

// ─── Sales ────────────────────────────────────────────────────────────────────

export const getManufacturerSales = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.json({ success: true, data: mockSales });
    }
    const sales = await ManufacturerSale.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: sales });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer sales");
  }
};

export const createManufacturerSale = async (req: Request, res: Response) => {
  try {
    const salePayload = {
      orderId: normalizeString(req.body.orderId) || generateId("SALES"),
      customerName: normalizeString(req.body.customerName),
      customerPhone: normalizeString(req.body.customerPhone),
      customerEmail: normalizeString(req.body.customerEmail),
      items: req.body.items || [],
      subtotal: Number(req.body.subtotal) || 0,
      discount: Number(req.body.discount) || 0,
      tax: Number(req.body.tax) || 0,
      total: Number(req.body.total) || 0,
      payable: Number(req.body.payable) || 0,
      paymentMethod: normalizeString(req.body.paymentMethod),
      payments: req.body.payments || [],
      status: normalizeString(req.body.status, "completed"),
      branchCode: normalizeString(req.body.branchCode, "MAIN"),
      createdAt: new Date(),
    };

    if (!isDbConnected()) {
      const sale = { ...salePayload, _id: `mock_sale_${Date.now()}` };
      mockSales.push(sale);
      return res.status(201).json({ success: true, data: sale, message: "Manufacturer sale recorded (offline)" });
    }

    const sale = new ManufacturerSale(salePayload);
    await sale.save();
    return res.status(201).json({ success: true, data: sale, message: "Manufacturer sale recorded" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer sale");
  }
};

// ─── Wholesale ────────────────────────────────────────────────────────────────

export const getManufacturerWholesaleOrders = async (_req: Request, res: Response) => {
  try {
    const orders = await ManufacturerWholesaleOrder.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: orders });
  } catch (error) {
    return respondError(res, error, "Failed to load manufacturer wholesale orders");
  }
};

export const createManufacturerWholesaleChallan = async (req: Request, res: Response) => {
  try {
    const order = new ManufacturerWholesaleOrder({
      orderId: normalizeString(req.body.orderId) || generateId("WHO"),
      invoiceNumber: normalizeString(req.body.invoiceNumber) || generateId("INV"),
      customerName: normalizeString(req.body.customer),
      customerPhone: normalizeString(req.body.customerPhone),
      items: req.body.items || [
        {
          description: req.body.itemDescription,
          metal: req.body.metal,
          purity: req.body.purity,
          weight: Number(req.body.weight) || 0,
          unitRate: Number(req.body.unitRate) || 0,
          quantity: Number(req.body.quantity) || 1,
          total: Number(req.body.total) || 0,
        }
      ],
      subtotal: Number(req.body.subtotal) || (Number(req.body.unitRate) * (Number(req.body.quantity) || 1)) || 0,
      discount: Number(req.body.discount) || 0,
      tax: Number(req.body.tax) || 0,
      total: Number(req.body.total) || 0,
      deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : new Date(),
      status: normalizeString(req.body.status, "PENDING"),
      notes: normalizeString(req.body.notes),
      createdAt: new Date(),
    });
    await order.save();
    return res.status(201).json({ success: true, data: order, message: "Manufacturer wholesale challan created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer wholesale challan");
  }
};

export const createManufacturerWholesaleInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = new ManufacturerWholesaleOrder({
      orderId: normalizeString(req.body.orderId) || generateId("WHO"),
      invoiceNumber: normalizeString(req.body.invoiceNumber) || generateId("INV"),
      customerName: normalizeString(req.body.customer),
      customerPhone: normalizeString(req.body.customerPhone),
      items: req.body.items || [
        {
          description: req.body.itemDescription,
          metal: req.body.metal,
          purity: req.body.purity,
          weight: Number(req.body.weight) || 0,
          unitRate: Number(req.body.unitRate) || 0,
          quantity: Number(req.body.quantity) || 1,
          total: Number(req.body.total) || 0,
        }
      ],
      subtotal: Number(req.body.subtotal) || (Number(req.body.unitRate) * (Number(req.body.quantity) || 1)) || 0,
      discount: Number(req.body.discount) || 0,
      tax: Number(req.body.tax) || 0,
      total: Number(req.body.total) || 0,
      deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : new Date(),
      status: normalizeString(req.body.status, "INVOICE"),
      notes: normalizeString(req.body.notes),
      createdAt: new Date(),
    });
    await invoice.save();
    return res.status(201).json({ success: true, data: invoice, message: "Manufacturer wholesale invoice created" });
  } catch (error) {
    return respondError(res, error, "Failed to create manufacturer wholesale invoice");
  }
};

export const deleteManufacturerWholesaleOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let order = await ManufacturerWholesaleOrder.findById(id);
    if (!order) {
      order = await ManufacturerWholesaleOrder.findOne({ orderId: id });
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Wholesale order not found" });
    }
    await ManufacturerWholesaleOrder.deleteOne({ _id: order._id });
    return res.json({ success: true });
  } catch (error) {
    return respondError(res, error, "Failed to delete wholesale order");
  }
};

export const updateManufacturerWholesaleOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ["CONFIRMED", "DISPATCHED", "DELIVERED"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${allowed.join(", ")}` });
    }
    let order = await ManufacturerWholesaleOrder.findById(id);
    if (!order) {
      order = await ManufacturerWholesaleOrder.findOne({ orderId: id });
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Wholesale order not found" });
    }
    order.status = status;
    await order.save();
    return res.json({ success: true, data: order });
  } catch (error) {
    return respondError(res, error, "Failed to update wholesale order status");
  }
};

export const updateManufacturerOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let order = await ManufacturerOrder.findById(id);
    if (!order) {
      order = await ManufacturerOrder.findOne({ id: id });
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Manufacturer order not found" });
    }
    Object.assign(order, req.body, { updatedAt: new Date() });
    await order.save();
    return res.json(order);
  } catch (error) {
    return respondError(res, error, "Failed to update manufacturer order");
  }
};

export const deleteManufacturerOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let order = await ManufacturerOrder.findById(id);
    if (!order) {
      order = await ManufacturerOrder.findOne({ id: id });
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Manufacturer order not found" });
    }
    await ManufacturerOrder.deleteOne({ _id: order._id });
    return res.json({ success: true });
  } catch (error) {
    return respondError(res, error, "Failed to delete manufacturer order");
  }
};
