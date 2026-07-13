import { Request, Response } from "express";
import { Order, Customer } from "../../models/index.js";
import { mockOrders } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";

const allowedOrderStatuses = ["PENDING", "PROCESSING", "READY", "DELIVERED"];

const normalizeOrderPayload = (req: Request) => ({
  ...req.body,
  customer: req.body.customer || req.body.customerName || '',
  customerPhone: req.body.customerPhone || '',
  customerEmail: req.body.customerEmail || '',
  customerAadhar: req.body.customerAadhar || '',
  specifications: req.body.specifications || '',
  status: String(req.body.status || 'PENDING').toUpperCase(),
  priority: req.body.priority || 'Normal',
  metalType: req.body.metalType || 'GOLD',
  carat: req.body.carat || req.body.customCarat || '',
  customCarat: req.body.customCarat || '',
  diamondDetails: Array.isArray(req.body.diamondDetails) ? req.body.diamondDetails : [],
  assignedKarikarId: req.body.assignedKarikarId || '',
  assignedKarikarName: req.body.assignedKarikarName || '',
  designCode: req.body.designCode || '',
  designName: req.body.designName || '',
  customDescription: req.body.customDescription || '',
  uploadedImages: Array.isArray(req.body.uploadedImages) ? req.body.uploadedImages : [],
  issuedGrams: Number(req.body.issuedGrams || req.body.weight || 0),
  metalLossGrams: Number(req.body.metalLossGrams || 0),
  gstRate: Number(req.body.gstRate || 3),
  sellingPrice: Number(req.body.sellingPrice || req.body.totalPrice || 0),
  estimatedMetalValue: Number(req.body.estimatedMetalValue || 0),
  metalLossCost: Number(req.body.metalLossCost || 0),
  diamondValue: Number(req.body.diamondValue || 0),
  labourCharges: Number(req.body.labourCharges || 0),
  gstAmount: Number(req.body.gstAmount || 0),
  totalPrice: Number(req.body.totalPrice || 0),
  profitAmount: Number(req.body.profitAmount || 0),
  profitMargin: Number(req.body.profitMargin || 0),
  inventoryReference: req.body.inventoryReference || '',
  assignedKarikarStatus: req.body.assignedKarikarStatus || req.body.workloadSummary?.status || '',
  billingSummary: {
    issuedGrams: Number(req.body.billingSummary?.issuedGrams || req.body.issuedGrams || 0),
    metalLossGrams: Number(req.body.billingSummary?.metalLossGrams || req.body.metalLossGrams || 0),
    metalLossCost: Number(req.body.billingSummary?.metalLossCost || req.body.metalLossCost || 0),
    labourCharges: Number(req.body.billingSummary?.labourCharges || req.body.labourCharges || 0),
    diamondValue: Number(req.body.billingSummary?.diamondValue || req.body.diamondValue || 0),
    gstRate: Number(req.body.billingSummary?.gstRate || req.body.gstRate || 3),
    gstAmount: Number(req.body.billingSummary?.gstAmount || req.body.gstAmount || 0),
    estimatedMetalValue: Number(req.body.billingSummary?.estimatedMetalValue || req.body.estimatedMetalValue || 0),
    sellingPrice: Number(req.body.billingSummary?.sellingPrice || req.body.sellingPrice || 0),
    totalPrice: Number(req.body.billingSummary?.totalPrice || req.body.totalPrice || 0),
    profitAmount: Number(req.body.billingSummary?.profitAmount || req.body.profitAmount || 0),
    profitMargin: Number(req.body.billingSummary?.profitMargin || req.body.profitMargin || 0),
  },
  workloadSummary: req.body.workloadSummary || {
    assignedKarikarId: req.body.assignedKarikarId || '',
    assignedKarikarName: req.body.assignedKarikarName || '',
    status: req.body.assignedKarikarStatus || '',
    currentJobCount: 0,
    notes: '',
  },
  createdAt: req.body.createdAt || new Date().toISOString(),
});

export const getOrders = async (_req: Request, res: Response) => {
  try {
    if (!isDbConnected()) return res.json(mockOrders);
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const payload = normalizeOrderPayload(req);
    if (!isDbConnected()) {
      const order = { ...payload, _id: `mock_order_${Date.now()}` };
      mockOrders.push(order);
      return res.json(order);
    }

    if (payload.customerPhone || payload.customerEmail || payload.customer) {
      const query: any = [];
      if (payload.customerPhone) query.push({ phone: payload.customerPhone });
      if (payload.customerEmail) query.push({ email: payload.customerEmail });
      if (payload.customer) query.push({ name: payload.customer });
      
      const customer = await Customer.findOne({ $or: query }).lean();
      if (customer && (customer.customerTier === "BLACKLISTED" || customer.tags?.includes("BLACKLISTED"))) {
        return res.status(403).json({
          success: false,
          error: `Customer is blacklisted and cannot create new orders. Reason: ${customer.blacklistReason || "compliance risk"}`,
        });
      }
    }

    const order = new Order(payload);
    await order.save();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const status = typeof req.body?.status === "string" ? req.body.status.trim().toUpperCase() : "";

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    if (!allowedOrderStatuses.includes(status)) {
      return res.status(400).json({
        error: "status must be one of: PENDING, PROCESSING, READY, DELIVERED",
      });
    }

    if (!isDbConnected()) {
      const orderIndex = mockOrders.findIndex((order: any) => order.id === id || order._id === id);

      if (orderIndex === -1) {
        return res.status(404).json({ error: "Order not found" });
      }

      const updatedOrder = {
        ...mockOrders[orderIndex],
        status,
      };

      mockOrders[orderIndex] = updatedOrder;
      return res.json(updatedOrder);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update order status" });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (!isDbConnected()) {
      const idx = mockOrders.findIndex((o: any) => o.id === id || o._id === id);
      if (idx >= 0) mockOrders.splice(idx, 1);
      return res.json({ success: true });
    }
    await Order.findByIdAndDelete(id as any);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    if (!isDbConnected()) {
      const orderIndex = mockOrders.findIndex((order: any) => order.id === id || order._id === id);

      if (orderIndex === -1) {
        return res.status(404).json({ error: "Order not found" });
      }

      const updatedOrder = {
        ...mockOrders[orderIndex],
        ...req.body,
      };

      mockOrders[orderIndex] = updatedOrder;
      return res.json(updatedOrder);
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ error: "Failed to update order" });
  }
};


