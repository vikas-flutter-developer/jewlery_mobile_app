import { Request, Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import mongoose from "mongoose";
import { Customer } from "../../models/index.js";

import { financeAuditService } from "../../services/financial/financeAuditService.js";
import { buildAuditContextFromRequest } from "../finance/financeAuditController.js";
import {
  addFallbackCustomer,
  findFallbackCustomerById,
  findFallbackCustomerByPan,
  findFallbackCustomerByPhone,
  getAllFallbackCustomers,
  searchFallbackCustomers,
  updateFallbackCustomer,
} from "../../../lib/fallbackStore.js";

const normalizeCustomer = (customer: any) => ({
  id: customer._id || customer.id,
  name: customer.name || "",
  email: customer.email || null,
  phone: customer.phone || null,
  mobile: customer.phone || null,
  pan: customer.pan || null,
  aadhar: customer.aadhar || null,
  address: customer.address || null,
  city: customer.city || null,
  state: customer.state || null,
  pincode: customer.pincode || null,
  kycStatus: customer.kycStatus || "PENDING",
  kycDocuments: Array.isArray(customer.kycDocuments) ? customer.kycDocuments : [],
  creditLimit: customer.creditLimit ?? 0,
  creditBlocked: customer.creditBlocked ?? false,
  loyaltyPoints: customer.loyaltyPoints ?? 0,
  totalPurchases: customer.totalPurchases ?? 0,
  customerSince: customer.customerSince || customer.createdAt || null,
  ledgerAccountId: customer.ledgerAccountId || null,
  loyaltyWalletId: customer.loyaltyWalletId || null,
  customerTier: customer.customerTier || "REGULAR",
  vipSince: customer.vipSince || null,
  blacklistReason: customer.blacklistReason || null,
  blacklistDate: customer.blacklistDate || null,
  blacklistedBy: customer.blacklistedBy || null,
  tierNotes: customer.tierNotes || null,
  tags: Array.isArray(customer.tags) ? customer.tags : ["REGULAR"],
  status: customer.status || "ACTIVE",
  createdAt: customer.createdAt || null,
  updatedAt: customer.updatedAt || null,
});

const createFallbackCustomer = async (payload: any) => {
  const id = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const customer = {
    _id: id,
    name: payload.name,
    phone: payload.phone,
    email: payload.email || undefined,
    pan: payload.pan || undefined,
    aadhar: payload.aadhar || undefined,
    address: payload.address || undefined,
    city: payload.city || undefined,
    state: payload.state || undefined,
    pincode: payload.pincode || undefined,
    kycStatus: payload.kycStatus || "PENDING",
    kycDocuments: Array.isArray(payload.kycDocuments) ? payload.kycDocuments : [],
    creditLimit: Number(payload.creditLimit) || 0,
    creditBlocked: payload.creditBlocked ?? false,
    loyaltyPoints: Number(payload.loyaltyPoints) || 0,
    totalPurchases: Number(payload.totalPurchases) || 0,
    customerSince: payload.customerSince || new Date().toISOString(),
    ledgerAccountId: payload.ledgerAccountId || `ledger-${id}`,
    loyaltyWalletId: payload.loyaltyWalletId || `wallet-${id}`,
    customerTier: payload.customerTier || "REGULAR",
    vipSince: payload.vipSince || undefined,
    blacklistReason: payload.blacklistReason || undefined,
    blacklistDate: payload.blacklistDate || undefined,
    blacklistedBy: payload.blacklistedBy || undefined,
    tierNotes: payload.tierNotes || undefined,
    tags: Array.isArray(payload.tags) ? payload.tags : [payload.customerTier || "REGULAR"],
    status: payload.status || "ACTIVE",
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };

  await addFallbackCustomer(customer);
  return customer;
};

const buildCustomerQuery = (query: any) => {
  const result: any = {};

  if (query.status) result.status = query.status;
  if (query.search) {
    result.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { phone: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
      { pan: { $regex: query.search, $options: "i" } },
    ];
  }

  return result;
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const customers = await getAllFallbackCustomers();
      const filtered = customers.filter((customer) => {
        if (status && customer.status !== status) return false;
        if (!search) return true;

        const value = String(search).toLowerCase();
        return [customer.name, customer.phone, customer.email, customer.pan]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(value));
      });

      return res.json({ success: true, data: filtered.map(normalizeCustomer) });
    }

    const customers = await Customer.find(buildCustomerQuery({ search, status })).populate("preferredBranch", "name code");
    return res.json({ success: true, data: customers.map(normalizeCustomer) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, phone, pan, panNumber, aadhar, gstin, address, city, state, pincode, creditLimit } = req.body;

    const normalizedPhone = mobile || phone;

    if (!name || !normalizedPhone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const panVal = panNumber || pan;
    const tenantId = (req as any).user?.tenantId || "default-shop";

    if (panVal) {
      const cleanPan = String(panVal).trim().toUpperCase();
      const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!PAN_PATTERN.test(cleanPan)) {
        return res.status(400).json({ error: "Invalid PAN format. Must match standard Indian PAN pattern (e.g. ABCDE1234F)." });
      }
      const existingPan = await Customer.findOne({ tenantId, panNumber: cleanPan });
      if (existingPan) {
        return res.status(409).json({ error: "Customer with this PAN number already exists" });
      }
    }

    const dbReady = mongoose.connection.readyState === 1;

    if (dbReady) {
      const existingCustomer = await Customer.findOne({ phone: normalizedPhone } as any);
      if (existingCustomer) {
        return res.status(409).json({ error: "Customer with this phone already exists" });
      }

      const customer = new Customer({
        name,
        email,
        phone: normalizedPhone,
        pan: panVal ? String(panVal).trim().toUpperCase() : undefined,
        panNumber: panVal ? String(panVal).trim().toUpperCase() : undefined,
        panStatus: "PENDING",
        tenantId,
        aadhar,
        gstin,
        address,
        city,
        state,
        pincode,
        kycStatus: "PENDING",
        kycDocuments: [],
        creditLimit: creditLimit || 0,
        creditBlocked: Boolean(req.body.creditBlocked),
        loyaltyPoints: 0,
        totalPurchases: 0,
        ledgerAccountId: `ledger-${Date.now()}`,
        loyaltyWalletId: `wallet-${Date.now()}`,
      });

      await customer.save();

      return res.status(201).json({
        success: true,
        message: "Customer created successfully",
        data: normalizeCustomer(customer.toObject()),
      });
    }

    const existingFallback = await findFallbackCustomerByPhone(normalizedPhone);
    if (existingFallback) {
      return res.status(409).json({ error: "Customer with this phone already exists" });
    }

    const customer = await createFallbackCustomer({
      name,
      phone: normalizedPhone,
      email,
      pan,
      aadhar,
      gstin,
      address,
      city,
      state,
      pincode,
      kycStatus: "PENDING",
      kycDocuments: [],
      creditLimit: creditLimit || 0,
      loyaltyPoints: 0,
      totalPurchases: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: normalizeCustomer(customer),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const searchCustomers = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const customers = await searchFallbackCustomers(q);
      return res.json({ success: true, data: customers.map(normalizeCustomer) });
    }

    const customers = await Customer.find({
      $or: [
        { phone: { $regex: q, $options: "i" } },
        { pan: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    });

    return res.json({ success: true, data: customers.map(normalizeCustomer) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const customer = await findFallbackCustomerById(id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      return res.json({ success: true, data: normalizeCustomer(customer) });
    }

    const customer = await Customer.findOne({ _id: id } as any).populate("preferredBranch", "name code");

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.json({ success: true, data: normalizeCustomer(customer.toObject()) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const dbReady = mongoose.connection.readyState === 1;

    const panVal = updates.panNumber || updates.pan;
    const tenantId = (req as any).user?.tenantId || "default-shop";

    if (panVal) {
      const cleanPan = String(panVal).trim().toUpperCase();
      const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!PAN_PATTERN.test(cleanPan)) {
        return res.status(400).json({ error: "Invalid PAN format. Must match standard Indian PAN pattern (e.g. ABCDE1234F)." });
      }
      if (dbReady) {
        const existingPan = await Customer.findOne({
          tenantId,
          panNumber: cleanPan,
          _id: { $ne: id },
        });
        if (existingPan) {
          return res.status(409).json({ error: "Customer with this PAN number already exists" });
        }
      }
      updates.pan = cleanPan;
      updates.panNumber = cleanPan;
    }

    if (!dbReady) {
      const existing = await findFallbackCustomerById(id);
      if (!existing) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const updated = await updateFallbackCustomer({
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      return res.json({ success: true, data: normalizeCustomer(updated) });
    }

    const customer = await Customer.findByIdAndUpdate(id as any, updates as any, { new: true } as any);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customerRecord = (customer as any)?.toObject ? (customer as any).toObject() : customer;
    return res.json({ success: true, data: normalizeCustomer(customerRecord) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

const getAuditContext = (req: any) => buildAuditContextFromRequest(req);

const normalizeCreditSummary = (customer: any) => {
  const creditLimit = Number(customer.creditLimit || 0);
  const outstandingBalance = Number(customer.outstandingBalance || 0);
  return {
    id: customer._id || customer.id,
    name: customer.name || "",
    phone: customer.phone || null,
    email: customer.email || null,
    creditLimit,
    outstandingBalance,
    availableCredit: Math.max(0, creditLimit - outstandingBalance),
    creditBlocked: Boolean(customer.creditBlocked),
  };
};

export const getCustomerCreditSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const customer = await findFallbackCustomerById(id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      return res.json({ success: true, data: normalizeCreditSummary(customer) });
    }

    const customer = await Customer.findById(id as any);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.json({ success: true, data: normalizeCreditSummary(customer.toObject()) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

const normalizeCustomerListResponse = (customer: any) => normalizeCustomer(customer);

const buildTierCounts = (customers: any[]) => {
  const summary = {
    totalCustomers: customers.length,
    vipCount: 0,
    blacklistedCount: 0,
    regularCount: 0,
  };

  customers.forEach((customer) => {
    const tier = (customer.customerTier || "REGULAR").toUpperCase();
    if (tier === "VIP") summary.vipCount += 1;
    else if (tier === "BLACKLISTED") summary.blacklistedCount += 1;
    else summary.regularCount += 1;
  });

  return summary;
};

const ensureTag = (tags: any[], tag: string) => {
  const normalized = Array.isArray(tags) ? tags.map((t) => String(t).trim().toUpperCase()).filter(Boolean) : [];
  if (!normalized.includes(tag)) normalized.push(tag);
  return normalized;
};

const withoutTag = (tags: any[], tag: string) => {
  return Array.isArray(tags) ? tags.map((t) => String(t).trim().toUpperCase()).filter((t) => t !== tag) : [];
};

export const getVipCustomers = async (req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) {
      const customers = (await getAllFallbackCustomers()).filter((cust) => String(cust.customerTier || cust.tags?.[0] || "").toUpperCase() === "VIP" || (Array.isArray(cust.tags) && cust.tags.map((t: any) => String(t).toUpperCase()).includes("VIP")));
      return res.json({ success: true, data: customers.map(normalizeCustomerListResponse) });
    }

    const customers = await Customer.find({
      $or: [
        { customerTier: "VIP" },
        { tags: "VIP" },
      ],
    });

    return res.json({ success: true, data: customers.map(normalizeCustomerListResponse) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getBlacklistedCustomers = async (req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) {
      const customers = (await getAllFallbackCustomers()).filter((cust) => String(cust.customerTier || cust.tags?.[0] || "").toUpperCase() === "BLACKLISTED" || (Array.isArray(cust.tags) && cust.tags.map((t: any) => String(t).toUpperCase()).includes("BLACKLISTED")));
      return res.json({ success: true, data: customers.map(normalizeCustomerListResponse) });
    }

    const customers = await Customer.find({
      $or: [
        { customerTier: "BLACKLISTED" },
        { tags: "BLACKLISTED" },
      ],
    });

    return res.json({ success: true, data: customers.map(normalizeCustomerListResponse) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getCustomerTierSummary = async (req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    let customers: any[] = [];

    if (!dbReady) {
      customers = await getAllFallbackCustomers();
    } else {
      customers = await Customer.find().lean();
    }

    return res.json({
      success: true,
      data: {
        summary: buildTierCounts(customers),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

const updateCustomerTierStatus = async (
  id: string,
  updates: any,
  auditType: string,
  previousData: any,
  newData: any,
  req: any
) => {
  const dbReady = mongoose.connection.readyState === 1;

  if (!dbReady) {
    const existing = await findFallbackCustomerById(id);
    if (!existing) {
      throw new Error("Customer not found");
    }
    const updated = await updateFallbackCustomer({
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return normalizeCustomer(updated);
  }

  const customer = await Customer.findById(id as any);
  if (!customer) {
    throw new Error("Customer not found");
  }

  Object.assign(customer, updates);
  customer.updatedAt = new Date();
  await customer.save();

  await financeAuditService.log({
    actionType: auditType as any,
    entityType: "CUSTOMER",
    entityId: String(customer._id),
    previousData,
    newData,
    context: getAuditContext(req),
  });

  return normalizeCustomer(customer.toObject());
};

export const markCustomerVip = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const note = String(req.body.note || "Marked as VIP customer");
    const actor = req.user?.email || req.user?.id || "system";

    const dbReady = mongoose.connection.readyState === 1;
    let existing: any;
    if (dbReady) {
      existing = await Customer.findById(id as any);
    } else {
      existing = await findFallbackCustomerById(id);
    }

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const currentTier = String(existing.customerTier || "REGULAR").toUpperCase();
    if (currentTier === "VIP") {
      return res.status(400).json({ error: "Customer is already a VIP" });
    }
    if (currentTier === "BLACKLISTED") {
      return res.status(400).json({ error: "Blacklisted customers cannot be marked as VIP" });
    }

    const previousData = { customerTier: currentTier, tags: existing.tags || [] };
    const newData = {
      customerTier: "VIP",
      tags: ["VIP"],
      vipSince: new Date(),
      tierNotes: note,
      blacklistReason: null,
      blacklistDate: null,
      blacklistedBy: null,
    };

    const result = await updateCustomerTierStatus(
      id,
      {
        customerTier: "VIP",
        vipSince: new Date(),
        tierNotes: note,
        tags: ensureTag(withoutTag([], "BLACKLISTED"), "VIP"),
        blacklistReason: undefined,
        blacklistDate: undefined,
        blacklistedBy: undefined,
      },
      "CUSTOMER_MARKED_VIP",
      previousData,
      { ...newData, markedBy: actor },
      req
    );

    await sendTierNotification(
      "CUSTOMER_MARKED_VIP",
      "Customer Marked VIP",
      `Customer ${existing.name} has been marked as a VIP customer.`,
      id
    );

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const removeCustomerVip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const note = String(req.body.note || "VIP status removed");
    const dbReady = mongoose.connection.readyState === 1;
    let existing: any;

    if (!dbReady) {
      existing = await findFallbackCustomerById(id);
      if (!existing) return res.status(404).json({ error: "Customer not found" });
    } else {
      existing = await Customer.findById(id as any);
      if (!existing) return res.status(404).json({ error: "Customer not found" });
    }

    const currentTier = String(existing.customerTier || "REGULAR").toUpperCase();
    if (currentTier !== "VIP") {
      return res.status(400).json({ error: "Customer is not a VIP" });
    }

    const previousData = {
      customerTier: currentTier,
      tags: existing.tags || [],
      vipSince: existing.vipSince || null,
    };

    const updated = await updateCustomerTierStatus(
      id,
      {
        customerTier: "REGULAR",
        vipSince: undefined,
        tierNotes: note,
        tags: withoutTag(existing.tags, "VIP"),
      },
      "CUSTOMER_REMOVED_VIP",
      previousData,
      { customerTier: "REGULAR", tierNotes: note },
      req
    );

    await sendTierNotification(
      "CUSTOMER_REMOVED_VIP",
      "VIP Status Removed",
      `VIP status has been removed from customer ${existing.name}.`,
      id
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const blacklistCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const reason = String(req.body.reason || "Blacklisted due to compliance or risk policy");
    const actor = req.user?.email || req.user?.id || "system";

    const dbReady = mongoose.connection.readyState === 1;
    let existing: any;
    if (dbReady) {
      existing = await Customer.findById(id as any);
    } else {
      existing = await findFallbackCustomerById(id);
    }

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const currentTier = String(existing.customerTier || "REGULAR").toUpperCase();
    if (currentTier === "BLACKLISTED") {
      return res.status(400).json({ error: "Customer is already blacklisted" });
    }

    const result = await updateCustomerTierStatus(
      id,
      {
        customerTier: "BLACKLISTED",
        blacklistReason: reason,
        blacklistDate: new Date(),
        blacklistedBy: actor,
        tierNotes: reason,
        tags: ensureTag(withoutTag(existing.tags || [], "VIP"), "BLACKLISTED"),
      },
      "CUSTOMER_BLACKLISTED",
      { customerTier: currentTier, tags: existing.tags || [] },
      { customerTier: "BLACKLISTED", blacklistReason: reason, blacklistedBy: actor },
      req
    );

    await sendTierNotification(
      "CUSTOMER_BLACKLISTED",
      "Customer Blacklisted",
      `Customer ${existing.name} has been blacklisted. Reason: ${reason}`,
      id
    );

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const removeCustomerBlacklist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = String(req.body.reason || "Blacklist removed by user action");
    const dbReady = mongoose.connection.readyState === 1;
    let existing: any;

    if (!dbReady) {
      existing = await findFallbackCustomerById(id);
      if (!existing) return res.status(404).json({ error: "Customer not found" });
    } else {
      existing = await Customer.findById(id as any);
      if (!existing) return res.status(404).json({ error: "Customer not found" });
    }

    const currentTier = String(existing.customerTier || "REGULAR").toUpperCase();
    if (currentTier !== "BLACKLISTED") {
      return res.status(400).json({ error: "Customer is not blacklisted" });
    }

    const previousData = {
      customerTier: currentTier,
      tags: existing.tags || [],
      blacklistReason: existing.blacklistReason || null,
      blacklistDate: existing.blacklistDate || null,
      blacklistedBy: existing.blacklistedBy || null,
    };

    const restoredTier = existing.tags && Array.isArray(existing.tags) && existing.tags.map((t: any) => String(t).toUpperCase()).includes("VIP") ? "VIP" : "NORMAL";
    const updated = await updateCustomerTierStatus(
      id,
      {
        customerTier: restoredTier,
        blacklistReason: undefined,
        blacklistDate: undefined,
        blacklistedBy: undefined,
        tierNotes: reason,
        tags: withoutTag(existing.tags, "BLACKLISTED"),
      },
      "CUSTOMER_REMOVED_BLACKLIST",
      previousData,
      { customerTier: restoredTier, tierNotes: reason },
      req
    );

    await sendTierNotification(
      "CUSTOMER_REMOVED_BLACKLIST",
      "Customer Removed From Blacklist",
      `Customer ${existing.name} has been removed from the blacklist.`,
      id
    );

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

const sendTierNotification = async (type: string, title: string, message: string, customerId: string) => {
  try {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) return;
    const { Notification } = await import("../../models/index.js");
    await Notification.create({
      notificationId: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      type,
      title,
      message,
      category: "Customer",
      severity: "INFO",
      channels: ["IN_APP"],
      relatedEntityId: customerId,
      reference: customerId,
      sendAt: new Date(),
      status: "PENDING",
    });
  } catch (err) {
    console.error("Failed to generate tier change notification:", err);
  }
};

export const updateCustomerCreditLimit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const creditLimit = Number(req.body.creditLimit);

    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      return res.status(400).json({ error: "creditLimit must be a non-negative number" });
    }

    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const existing = await findFallbackCustomerById(id);
      if (!existing) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const updated = await updateFallbackCustomer({
        ...existing,
        creditLimit,
        updatedAt: new Date().toISOString(),
      });

      return res.json({ success: true, data: normalizeCreditSummary(updated) });
    }

    const customer = await Customer.findById(id as any);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const previousCreditLimit = Number(customer.creditLimit || 0);
    customer.creditLimit = creditLimit;
    customer.updatedAt = new Date();
    await customer.save();

    await financeAuditService.log({
      actionType: "CREDIT_LIMIT_UPDATED",
      entityType: "CUSTOMER",
      entityId: String(customer._id),
      previousData: { creditLimit: previousCreditLimit, outstandingBalance: customer.outstandingBalance },
      newData: { creditLimit, outstandingBalance: customer.outstandingBalance },
      context: getAuditContext(req),
    });

    return res.json({ success: true, data: normalizeCreditSummary(customer.toObject()) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const blockCustomerCredit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = String(req.body.reason || "Credit blocked by user action");
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const existing = await findFallbackCustomerById(id);
      if (!existing) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const updated = await updateFallbackCustomer({
        ...existing,
        creditBlocked: true,
        updatedAt: new Date().toISOString(),
      });

      return res.json({ success: true, data: normalizeCreditSummary(updated) });
    }

    const customer = await Customer.findById(id as any);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    customer.creditBlocked = true;
    customer.updatedAt = new Date();
    await customer.save();

    await financeAuditService.log({
      actionType: "CREDIT_BLOCKED",
      entityType: "CUSTOMER",
      entityId: String(customer._id),
      previousData: { creditBlocked: false, creditLimit: customer.creditLimit, outstandingBalance: customer.outstandingBalance },
      newData: { creditBlocked: true, reason },
      context: getAuditContext(req),
    });

    return res.json({ success: true, data: normalizeCreditSummary(customer.toObject()) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const unblockCustomerCredit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reason = String(req.body.reason || "Credit unblocked by user action");
    const dbReady = mongoose.connection.readyState === 1;

    if (!dbReady) {
      const existing = await findFallbackCustomerById(id);
      if (!existing) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const updated = await updateFallbackCustomer({
        ...existing,
        creditBlocked: false,
        updatedAt: new Date().toISOString(),
      });

      return res.json({ success: true, data: normalizeCreditSummary(updated) });
    }

    const customer = await Customer.findById(id as any);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    customer.creditBlocked = false;
    customer.updatedAt = new Date();
    await customer.save();

    await financeAuditService.log({
      actionType: "CREDIT_UNBLOCKED",
      entityType: "CUSTOMER",
      entityId: String(customer._id),
      previousData: { creditBlocked: true, creditLimit: customer.creditLimit, outstandingBalance: customer.outstandingBalance },
      newData: { creditBlocked: false, reason },
      context: getAuditContext(req),
    });

    return res.json({ success: true, data: normalizeCreditSummary(customer.toObject()) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const uploadCustomerKyc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1;
    const files = (req as any).files || {};

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ error: "PAN/Aadhar files are required" });
    }

    const uploadedDocuments: Array<{ type: string; documentPath: string; uploadedAt: string }> = [];

    for (const [fieldName, fileList] of Object.entries(files)) {
      const file = Array.isArray(fileList) ? fileList[0] : fileList;
      if (!file) continue;

      const documentType = fieldName === "pan" ? "PAN" : fieldName === "aadhar" ? "AADHAR" : "PAN";
      uploadedDocuments.push({
        type: documentType,
        documentPath: file.path,
        uploadedAt: new Date().toISOString(),
      });
    }

    if (uploadedDocuments.length === 0) {
      return res.status(400).json({ error: "PAN/Aadhar files are required" });
    }

    if (dbReady) {
      const customer = await Customer.findById(id as any);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      customer.kycDocuments = [...(customer.kycDocuments || []), ...uploadedDocuments];
      customer.kycStatus = "PENDING";
      customer.updatedAt = new Date();
      await customer.save();

      return res.json({
        success: true,
        data: normalizeCustomer(customer.toObject()),
      });
    }

    const customer = await findFallbackCustomerById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const updatedCustomer = {
      ...customer,
      kycDocuments: [...(customer.kycDocuments || []), ...uploadedDocuments],
      kycStatus: "PENDING",
      updatedAt: new Date().toISOString(),
    };

    await updateFallbackCustomer(updatedCustomer);

    return res.json({
      success: true,
      data: normalizeCustomer(updatedCustomer),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};


