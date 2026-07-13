import { Request, Response } from 'express';
import { ManufacturerPurchaseOrder } from '../../models/index.js';

const generatePoNumber = async (): Promise<string> => {
  const count = await ManufacturerPurchaseOrder.countDocuments();
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PO-${datePart}-${String(count + 1).padStart(4, '0')}`;
};

const respondError = (res: Response, error: any, fallback = 'Server error') => {
  const message = error?.message || fallback;
  return res.status(500).json({ success: false, error: message });
};

// GET /manufacturer/purchase-orders
export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { status, search, from, to } = req.query as Record<string, string>;

    const filter: Record<string, any> = {};

    if (status && status !== 'ALL') {
      filter.status = status === 'ORDERED' ? 'PENDING' : status;
    }

    if (from || to) {
      filter.receivedAt = {};
      if (from) filter.receivedAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.receivedAt.$lte = toDate;
      }
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { poNumber: regex },
        { supplier: regex },
        { item: regex },
        { invoiceNumber: regex },
      ];
    }

    const orders = await ManufacturerPurchaseOrder.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Map properties to Flutter frontend expectations
    const mappedOrders = orders.map((order: any) => ({
      ...order,
      vendorName: order.supplier,
      metalType: order.metal,
      weightGrams: order.weight,
      ratePerGram: order.rate,
      totalAmount: order.total,
      status: order.status === 'PENDING' ? 'ORDERED' : order.status
    }));

    return res.json({ success: true, data: mappedOrders });
  } catch (error) {
    return respondError(res, error, 'Failed to fetch purchase orders');
  }
};

// POST /manufacturer/purchase-orders
export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    const unit = Number(body.unit) || 1;
    const weight = Number(body.weight || body.weightGrams) || 0;
    const rate = Number(body.rate || body.ratePerGram) || 0;
    const makingCharges = Number(body.makingCharges) || 0;
    const gstPercent = Number(body.gstPercent) ?? 3;

    const metalValue = unit * rate;
    const subtotal = metalValue + makingCharges;
    const gstAmount = (subtotal * gstPercent) / 100;
    const total = body.totalAmount || (subtotal + gstAmount);

    const poNumber = await generatePoNumber();
    
    // Normalize metal string: 'GOLD' -> 'Gold'
    let metal = body.metal || body.metalType || 'Gold';
    metal = metal.charAt(0).toUpperCase() + metal.slice(1).toLowerCase();
    if (!['Gold', 'Silver', 'Platinum'].includes(metal)) {
      metal = 'Gold';
    }

    const order = new ManufacturerPurchaseOrder({
      poNumber,
      supplier: String(body.supplier || body.vendorName || '').trim(),
      item: String(body.item || 'Raw Metal').trim(),
      unit,
      metal,
      purity: body.purity || '22K',
      weight,
      rate,
      makingCharges,
      gstPercent,
      total,
      invoiceNumber: String(body.invoiceNumber || '').trim() || undefined,
      status: body.status === 'ORDERED' ? 'PENDING' : (body.status || 'PENDING'),
      receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
      notes: String(body.notes || '').trim() || undefined,
    });

    await order.save();

    // Map back for response
    const mappedOrder = {
      ...order.toObject(),
      vendorName: order.supplier,
      metalType: order.metal,
      weightGrams: order.weight,
      ratePerGram: order.rate,
      totalAmount: order.total,
      status: order.status === 'PENDING' ? 'ORDERED' : order.status
    };

    return res.status(201).json({
      success: true,
      data: mappedOrder,
      message: `Purchase order ${poNumber} created`,
    });
  } catch (error) {
    return respondError(res, error, 'Failed to create purchase order');
  }
};

// PUT /manufacturer/purchase-orders/:id
export const updatePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Recompute total if weight/rate/making/gst are updated
    const updates: Record<string, any> = { ...body };

    if (body.unit !== undefined || body.rate !== undefined || body.makingCharges !== undefined || body.gstPercent !== undefined || body.weight !== undefined) {
      const existing = await ManufacturerPurchaseOrder.findById(req.params.id).lean() as any;
      if (!existing) return res.status(404).json({ success: false, error: 'Purchase order not found' });

      const unit = Number(body.unit ?? existing.unit ?? 1);
      const weight = Number(body.weight ?? existing.weight);
      const rate = Number(body.rate ?? existing.rate);
      const makingCharges = Number(body.makingCharges ?? existing.makingCharges);
      const gstPercent = Number(body.gstPercent ?? existing.gstPercent ?? 3);

      const metalValue = unit * rate;
      const subtotal = metalValue + makingCharges;
      const gstAmount = (subtotal * gstPercent) / 100;
      updates.total = subtotal + gstAmount;
      updates.unit = unit;
      updates.weight = weight;
      updates.rate = rate;
      updates.makingCharges = makingCharges;
      updates.gstPercent = gstPercent;
    }

    const updated = await ManufacturerPurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    return respondError(res, error, 'Failed to update purchase order');
  }
};

// DELETE /manufacturer/purchase-orders/:id
export const deletePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const deleted = await ManufacturerPurchaseOrder.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    return res.json({ success: true, message: 'Purchase order deleted' });
  } catch (error) {
    return respondError(res, error, 'Failed to delete purchase order');
  }
};
