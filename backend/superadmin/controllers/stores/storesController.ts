import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  PlatformStoreRecord,
  PlatformStoreDocument,
  readPlatformStore,
  writePlatformStore,
  planPriceFor,
} from '../../../lib/platformStore.js';
import {
  SuperAdminUser as User,
  SuperAdminSubscription as Subscription,
  SuperAdminSecurityAudit as SecurityAudit,
} from '../../models/index.js';
import { isDbConnected } from "../../../lib/serverState.js";
import {
  getAllFallbackUsers,
  addFallbackUser,
  findFallbackUserByEmail,
  updateFallbackUser,
  FallbackUser,
  deleteFallbackStoreData
} from "../../../lib/fallbackStore.js";
import { retailerDb, manufacturerDb } from "../../../lib/db.js";
import InventoryModel from "../../../models/Inventory.js";
import TaskModel from "../../../models/Task.js";
import RepairJobModel from "../../../models/RepairJob.js";
import UserModel from "../../../models/User.js";

const Inventory = retailerDb.models.Inventory || retailerDb.model("Inventory", InventoryModel.schema);
const Task = manufacturerDb.models.Task || manufacturerDb.model("Task", TaskModel.schema);
const RepairJob = retailerDb.models.RepairJob || retailerDb.model("RepairJob", RepairJobModel.schema);
const RetailerUser = retailerDb.models.User || retailerDb.model("User", UserModel.schema);
const ManufacturerUser = manufacturerDb.models.User || manufacturerDb.model("User", UserModel.schema);

const planOptions = ['1MONTH', '3MONTH', '6MONTH', '1YEAR', '2YEAR'];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const daysUntilExpiry = (expiry: string) => {
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const asString = (value: unknown, fallback = '') => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
};

const appendAuditLog = async (
  document: PlatformStoreDocument | null,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string
) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    if (dbReady) {
      await SecurityAudit.create({
        id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        actor,
        action,
        entityType,
        entityId,
        details,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Failed to append security audit log to MongoDB:", error);
  }

  try {
    const doc = document || await readPlatformStore();
    doc.auditLogs.unshift({
      id: `AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      actor,
      action,
      entityType,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    });

    if (doc.auditLogs.length > 100) {
      doc.auditLogs = doc.auditLogs.slice(0, 100);
    }

    if (!document) {
      await writePlatformStore(doc);
    }
  } catch (error) {
    console.error("Failed to append audit log to fallback platform store:", error);
  }
};

const computeMetrics = (stores: PlatformStoreRecord[]) => {
  const active = stores.filter((store) => store.status === 'ACTIVE').length;
  const pending = stores.filter((store) => store.paymentStatus === 'DUE' || store.paymentStatus === 'FAILED').length;
  const suspended = stores.filter((store) => store.status === 'SUSPENDED').length;
  const trial = stores.filter((store) => store.status === 'TRIAL').length;
  const dueSoon = stores.filter((store) => store.status !== 'SUSPENDED' && daysUntilExpiry(store.subscriptionExpiry) <= 7).length;
  const planMonths: Record<string, number> = {
    '1MONTH': 1,
    '3MONTH': 3,
    '6MONTH': 6,
    '1YEAR': 12,
    '2YEAR': 24,
  };

  const mrr = stores
    .filter((store) => store.status === 'ACTIVE' || store.status === 'TRIAL')
    .reduce((sum, store) => sum + planPriceFor(store.planName) / (planMonths[store.planName.toUpperCase()] ?? 12), 0);

  return {
    totalStores: stores.length,
    activeStores: active,
    pendingStores: pending,
    suspendedStores: suspended,
    trialStores: trial,
    dueSoon,
    mrr: Math.round(mrr),
  };
};

export const getSuperAdminMetrics = async (_req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    if (dbReady) {
      const stores = await Subscription.find({}).lean();
      return res.json({
        success: true,
        data: computeMetrics(stores as any[]),
      });
    } else {
      const document = await readPlatformStore();
      return res.json({
        success: true,
        data: computeMetrics(document.stores),
      });
    }
  } catch (error) {
    console.error('Failed to load super admin metrics', error);
    return res.status(500).json({ success: false, error: 'Failed to load metrics' });
  }
};

export const getSuperAdminStores = async (_req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    if (dbReady) {
      const stores = await Subscription.find({}).sort({ joinDate: -1 }).lean();
      return res.json({
        success: true,
        data: stores,
      });
    } else {
      const document = await readPlatformStore();
      return res.json({
        success: true,
        data: document.stores,
      });
    }
  } catch (error) {
    console.error('Failed to load stores', error);
    return res.status(500).json({ success: false, error: 'Failed to load stores' });
  }
};

export const createSuperAdminStore = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!isPlainObject(payload)) {
      return res.status(400).json({ success: false, error: 'store payload must be an object' });
    }

    const shopName = asString(payload.shopName);
    const ownerName = asString(payload.ownerName, 'Owner');
    const email = asString(payload.email);
    const phone = asString(payload.phone);
    const address = asString(payload.address, '');
    const gstNumber = asString(payload.gstNumber, '');
    const panNumber = asString(payload.panNumber, '');
    const aadharNumber = asString(payload.aadharNumber, '');
    const planName = normalizePlan(payload.planName, '1YEAR');
    const paymentMethod = normalizePaymentMethod(payload.paymentMethod, 'UPI');
    const durationMonths = typeof payload.durationMonths === 'number' ? payload.durationMonths : 12;
    const storeType = asString(payload.storeType, 'RETAILER') === 'MANUFACTURER' ? 'MANUFACTURER' : 'RETAILER';
    const rawPassword = asString(payload.password, phone.slice(-4) || 'Pass@1234');

    if (!shopName || !email || !phone) {
      return res.status(400).json({ success: false, error: 'shopName, email, and phone are required' });
    }

    const now = new Date();
    const expiry = new Date(now);
    expiry.setMonth(expiry.getMonth() + durationMonths);
    const status = paymentMethod === 'CASH' || paymentMethod === 'CHECK' ? 'ACTIVE' : 'PENDING';

    const storeId = `store-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const storeData = {
      id: storeId,
      shopName,
      ownerName,
      email,
      phone,
      gstNumber,
      panNumber,
      aadharNumber,
      address,
      planName,
      status: status as any,
      paymentMethod: paymentMethod as any,
      paymentStatus: (status === 'ACTIVE' ? 'PAID' : 'DUE') as any,
      subscriptionExpiry: expiry.toISOString(),
      joinDate: now.toISOString(),
      reminderCount: 0,
      note: status === 'ACTIVE' ? 'Subscription added and activated' : 'Awaiting payment confirmation',
      storeType: storeType as any,
      updatedAt: now.toISOString(),
    };

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      await Subscription.create(storeData);
      const document = await readPlatformStore();
      if (!document.stores.some((s) => s.id === storeId)) {
        document.stores.unshift(storeData);
      }
      await appendAuditLog(document, 'super-admin', 'create-store', 'store', storeId, `Created store ${shopName}`);
      await writePlatformStore(document);
    } else {
      const document = await readPlatformStore();
      document.stores.unshift(storeData);
      await appendAuditLog(document, 'super-admin', 'create-store', 'store', storeId, `Created store ${shopName}`);
      await writePlatformStore(document);
    }

    // ── Create the login user account for this store ──
    const userRole = storeType === 'MANUFACTURER' ? 'ADMIN' : 'RETAILER';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const userId = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const dbReadyUser = mongoose.connection.readyState === 1;

    if (dbReadyUser) {
      try {
        const TargetUser = storeType === 'MANUFACTURER' ? ManufacturerUser : RetailerUser;
        const existingMongoUser = await TargetUser.findOne({ email } as any);
        if (!existingMongoUser) {
          await TargetUser.create({
            _id: new mongoose.Types.ObjectId(),
            name: ownerName,
            email,
            phone,
            password: hashedPassword,
            role: userRole,
            tenantId: storeId,
            status: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
          } as any);
        } else {
          existingMongoUser.role = userRole;
          existingMongoUser.tenantId = storeId;
          existingMongoUser.password = hashedPassword;
          existingMongoUser.status = 'ACTIVE';
          existingMongoUser.updatedAt = now;
          await existingMongoUser.save();
        }
      } catch (mongoErr) {
        console.warn('MongoDB user creation failed, falling back to file store:', mongoErr);
      }
    }

    // Always create/update fallback user so offline login works too
    const existingFallback = await findFallbackUserByEmail(email);
    if (!existingFallback) {
      const newFallbackUser: FallbackUser = {
        _id: userId,
        name: ownerName,
        email,
        phone,
        password: hashedPassword,
        role: userRole,
        tenantId: storeId,
        status: 'ACTIVE',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await addFallbackUser(newFallbackUser);
    } else {
      existingFallback.role = userRole;
      existingFallback.tenantId = storeId;
      existingFallback.password = hashedPassword;
      existingFallback.status = 'ACTIVE';
      existingFallback.updatedAt = now.toISOString();
      await updateFallbackUser(existingFallback);
    }

    return res.status(201).json({ success: true, data: storeData, user: { email, role: userRole, tenantId: storeId } });
  } catch (error) {
    console.error('Failed to create store', error);
    return res.status(500).json({ success: false, error: 'Failed to create store' });
  }
};

export const patchSuperAdminStore = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!isPlainObject(payload)) {
      return res.status(400).json({ success: false, error: 'payload must be an object' });
    }

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    const now = new Date();

    if (dbReady) {
      const store = await Subscription.findOne({ id });
      if (!store) {
        return res.status(404).json({ success: false, error: 'store not found' });
      }

      const nextStatus = normalizeStatus(payload.status, store.status as any);
      const nextPlan = normalizePlan(payload.planName, store.planName);
      const durationMonths = typeof payload.durationMonths === 'number' ? payload.durationMonths : undefined;
      const trialDays = typeof payload.trialDays === 'number' ? payload.trialDays : 14;

      if (payload.ownerName !== undefined) store.ownerName = asString(payload.ownerName, store.ownerName);
      if (payload.email !== undefined) store.email = asString(payload.email, store.email);
      if (payload.phone !== undefined) store.phone = asString(payload.phone, store.phone);
      if (payload.address !== undefined) store.address = asString(payload.address, store.address);
      if (payload.gstNumber !== undefined) store.gstNumber = asString(payload.gstNumber, store.gstNumber);
      if (payload.panNumber !== undefined) store.panNumber = asString(payload.panNumber, store.panNumber);
      if (payload.aadharNumber !== undefined) store.aadharNumber = asString(payload.aadharNumber, store.aadharNumber);
      if (payload.note !== undefined) store.note = asString(payload.note, store.note);
      if (payload.paymentMethod !== undefined) store.paymentMethod = normalizePaymentMethod(payload.paymentMethod, store.paymentMethod as any);
      if (payload.storeType !== undefined) {
        store.storeType = asString(payload.storeType, store.storeType) === 'MANUFACTURER' ? 'MANUFACTURER' : 'RETAILER';
      }

      if (payload.planName !== undefined) {
        store.planName = nextPlan;
      }

      if (payload.status !== undefined) {
        store.status = nextStatus;
      }

      if (payload.paymentStatus !== undefined) {
        store.paymentStatus = normalizePaymentStatus(payload.paymentStatus, store.paymentStatus as any);
      }

      if (payload.subscriptionExpiry !== undefined) {
        store.subscriptionExpiry = asString(payload.subscriptionExpiry, store.subscriptionExpiry);
      }

      if (payload.lastLogin !== undefined) {
        store.lastLogin = asString(payload.lastLogin, store.lastLogin);
      }

      if (payload.lastReminderAt !== undefined) {
        store.lastReminderAt = asString(payload.lastReminderAt, store.lastReminderAt);
      }

      const nextReminderCount = typeof payload.reminderCount === 'number' ? payload.reminderCount : undefined;
      if (nextReminderCount !== undefined) {
        store.reminderCount = nextReminderCount >= 0 ? nextReminderCount : store.reminderCount ?? 0;
      }

      if (payload.action === 'send-reminder') {
        store.reminderCount = nextReminderCount ?? (store.reminderCount ?? 0) + 1;
        store.lastReminderAt = asString(payload.lastReminderAt, new Date().toISOString());
        store.note = asString(payload.note, 'Payment reminder queued for the store owner.');
      }

      if (durationMonths !== undefined) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + durationMonths);
        store.subscriptionExpiry = expiry.toISOString();
        store.status = 'ACTIVE';
        store.paymentStatus = 'PAID';
      }

      if (payload.status === 'TRIAL' || (payload.status === undefined && store.status === 'TRIAL')) {
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + trialDays);
        store.subscriptionExpiry = expiry.toISOString();
        store.paymentStatus = 'DUE';
      }

      if (store.status === 'ACTIVE' && store.paymentStatus === 'PAID') {
        store.note = store.note || 'Subscription active';
      }

      if (store.status === 'SUSPENDED') {
        store.paymentStatus = 'FAILED';
        store.note = asString(payload.note, 'Store suspended by super admin.');
      }

      if (store.status === 'EXPIRED') {
        store.paymentStatus = 'DUE';
      }

      store.updatedAt = new Date().toISOString();

      await store.save();
      await appendAuditLog(null, asString(payload.actor, 'super-admin'), payload.action ? String(payload.action) : 'update-store', 'store', store.id, `Updated store ${store.shopName}`);

      return res.json({ success: true, data: store });
    } else {
      const document = await readPlatformStore();
      const store = document.stores.find((item) => item.id === id);

      if (!store) {
        return res.status(404).json({ success: false, error: 'store not found' });
      }

      const nextStatus = normalizeStatus(payload.status, store.status);
      const nextPlan = normalizePlan(payload.planName, store.planName);
      const durationMonths = typeof payload.durationMonths === 'number' ? payload.durationMonths : undefined;
      const trialDays = typeof payload.trialDays === 'number' ? payload.trialDays : 14;

      if (payload.ownerName !== undefined) store.ownerName = asString(payload.ownerName, store.ownerName);
      if (payload.email !== undefined) store.email = asString(payload.email, store.email);
      if (payload.phone !== undefined) store.phone = asString(payload.phone, store.phone);
      if (payload.address !== undefined) store.address = asString(payload.address, store.address);
      if (payload.gstNumber !== undefined) store.gstNumber = asString(payload.gstNumber, store.gstNumber);
      if (payload.panNumber !== undefined) store.panNumber = asString(payload.panNumber, store.panNumber);
      if (payload.aadharNumber !== undefined) store.aadharNumber = asString(payload.aadharNumber, store.aadharNumber);
      if (payload.note !== undefined) store.note = asString(payload.note, store.note);
      if (payload.paymentMethod !== undefined) store.paymentMethod = normalizePaymentMethod(payload.paymentMethod, store.paymentMethod);
      if (payload.storeType !== undefined) {
        store.storeType = asString(payload.storeType, store.storeType) === 'MANUFACTURER' ? 'MANUFACTURER' : 'RETAILER';
      }

      if (payload.planName !== undefined) {
        store.planName = nextPlan;
      }

      if (payload.status !== undefined) {
        store.status = nextStatus;
      }

      if (payload.paymentStatus !== undefined) {
        store.paymentStatus = normalizePaymentStatus(payload.paymentStatus, store.paymentStatus);
      }

      if (payload.subscriptionExpiry !== undefined) {
        store.subscriptionExpiry = asString(payload.subscriptionExpiry, store.subscriptionExpiry);
      }

      if (payload.lastReminderAt !== undefined) {
        store.lastReminderAt = asString(payload.lastReminderAt, store.lastReminderAt);
      }

      const nextReminderCount = typeof payload.reminderCount === 'number' ? payload.reminderCount : undefined;
      if (nextReminderCount !== undefined) {
        store.reminderCount = nextReminderCount >= 0 ? nextReminderCount : store.reminderCount ?? 0;
      }

      if (payload.action === 'send-reminder') {
        store.reminderCount = nextReminderCount ?? (store.reminderCount ?? 0) + 1;
        store.lastReminderAt = asString(payload.lastReminderAt, new Date().toISOString());
        store.note = asString(payload.note, 'Payment reminder queued for the store owner.');
      }

      if (durationMonths !== undefined) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + durationMonths);
        store.subscriptionExpiry = expiry.toISOString();
        store.status = 'ACTIVE';
        store.paymentStatus = 'PAID';
      }

      if (payload.status === 'TRIAL' || (payload.status === undefined && store.status === 'TRIAL')) {
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + trialDays);
        store.subscriptionExpiry = expiry.toISOString();
        store.paymentStatus = 'DUE';
      }

      if (store.status === 'ACTIVE' && store.paymentStatus === 'PAID') {
        store.note = store.note || 'Subscription active';
      }

      if (store.status === 'SUSPENDED') {
        store.paymentStatus = 'FAILED';
        store.note = asString(payload.note, 'Store suspended by super admin.');
      }

      if (store.status === 'EXPIRED') {
        store.paymentStatus = 'DUE';
      }

      store.updatedAt = new Date().toISOString();

      await appendAuditLog(document, asString(payload.actor, 'super-admin'), payload.action ? String(payload.action) : 'update-store', 'store', store.id, `Updated store ${store.shopName}`);
      await writePlatformStore(document);

      return res.json({ success: true, data: store });
    }
  } catch (error) {
    console.error('Failed to update store', error);
    return res.status(500).json({ success: false, error: 'Failed to update store' });
  }
};

export const deleteSuperAdminStore = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();

    if (dbReady) {
      const store = await Subscription.findOne({ id });
      if (!store) {
        return res.status(404).json({ success: false, error: 'Store not found' });
      }
      const shopName = store.shopName;
      await Subscription.deleteOne({ id });
      await appendAuditLog(null, 'super-admin', 'delete-store', 'store', id, `Deleted store ${shopName}`);

      try {
        await User.deleteMany({ tenantId: id });
        await RetailerUser.deleteMany({ tenantId: id });
        await ManufacturerUser.deleteMany({ tenantId: id });
        await Task.deleteMany({ tenantId: id });
        await RepairJob.deleteMany({ tenantId: id });
      } catch (dbErr) {
        console.warn('Failed to delete tenant data from MongoDB:', dbErr);
      }
      await deleteFallbackStoreData(id);
      return res.json({ success: true, message: `Store ${shopName} and all associated data deleted successfully.` });
    } else {
      const document = await readPlatformStore();
      const storeIndex = document.stores.findIndex((item) => item.id === id);

      if (storeIndex === -1) {
        return res.status(404).json({ success: false, error: 'Store not found' });
      }

      const shopName = document.stores[storeIndex].shopName;
      document.stores.splice(storeIndex, 1);
      await appendAuditLog(document, 'super-admin', 'delete-store', 'store', id, `Deleted store ${shopName}`);
      await writePlatformStore(document);

      await deleteFallbackStoreData(id);

      return res.json({ success: true, message: `Store ${shopName} and all associated data deleted successfully.` });
    }
  } catch (error: any) {
    console.error('Failed to delete store', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete store' });
  }
};

const normalizeStatus = (value: unknown, fallback: PlatformStoreRecord['status']) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.toUpperCase();
  if (['ACTIVE', 'EXPIRED', 'TRIAL', 'PENDING', 'SUSPENDED'].includes(normalized)) {
    return normalized as PlatformStoreRecord['status'];
  }
  return fallback;
};

const normalizePlan = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.toUpperCase();
  if (planOptions.includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizePaymentStatus = (value: unknown, fallback: PlatformStoreRecord['paymentStatus']) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.toUpperCase();
  if (['PAID', 'DUE', 'FAILED'].includes(normalized)) {
    return normalized as PlatformStoreRecord['paymentStatus'];
  }
  return fallback;
};

const normalizePaymentMethod = (value: unknown, fallback: PlatformStoreRecord['paymentMethod']) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.toUpperCase();
  if (['CASH', 'CHECK', 'UPI', 'CARD'].includes(normalized)) {
    return normalized as PlatformStoreRecord['paymentMethod'];
  }
  return fallback;
};
