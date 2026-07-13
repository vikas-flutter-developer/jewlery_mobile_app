import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  PlatformStoreDocument,
  readPlatformStore,
  writePlatformStore,
  planPriceFor,
} from '../../../lib/platformStore.js';
import {
  SuperAdminDemoAccess as DemoAccess,
  SuperAdminSecurityAudit as SecurityAudit,
} from '../../models/index.js';
import { isDbConnected } from "../../../lib/serverState.js";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asString = (value: unknown, fallback = '') => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
};

const nextInvoiceId = () => `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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

// ─── Demo Access ─────────────────────────────────────────────────────────────

export const getSuperAdminDemoAccess = async (_req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    if (dbReady) {
      let access = await DemoAccess.findOne({}).lean();
      if (!access) {
        const defaultAccess = {
          email: 'superadmin@aurajewel.com',
          password: 'superadmin',
          otp: '123456',
          updatedAt: new Date().toISOString(),
        };
        access = await DemoAccess.create(defaultAccess);
      }
      return res.json({ success: true, data: access });
    } else {
      const document = await readPlatformStore();
      return res.json({ success: true, data: document.demoAccess });
    }
  } catch (error) {
    console.error('Failed to load super admin demo access', error);
    return res.status(500).json({ success: false, error: 'Failed to load demo access' });
  }
};

export const updateSuperAdminDemoAccess = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!isPlainObject(payload)) {
      return res.status(400).json({ success: false, error: 'demo access payload must be an object' });
    }

    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    if (dbReady) {
      let access = await DemoAccess.findOne({});
      if (!access) {
        access = new DemoAccess({
          email: payload.email || 'superadmin@aurajewel.com',
          password: payload.password || 'superadmin',
          otp: payload.otp || '123456',
          updatedAt: new Date().toISOString(),
        });
      } else {
        if (payload.email !== undefined) access.email = payload.email;
        if (payload.password !== undefined) access.password = payload.password;
        if (payload.otp !== undefined) access.otp = payload.otp;
        access.updatedAt = new Date().toISOString();
      }
      await access.save();
      await appendAuditLog(null, 'super-admin', 'update-demo-access', 'platform', 'platform', 'Updated super admin demo access credentials');
      return res.json({ success: true, data: access });
    } else {
      const document = await readPlatformStore();
      const nextAccess = {
        email: asString(payload.email, document.demoAccess.email),
        password: asString(payload.password, document.demoAccess.password),
        otp: asString(payload.otp, document.demoAccess.otp),
        updatedAt: new Date().toISOString(),
      };

      document.demoAccess = nextAccess;
      await appendAuditLog(document, 'super-admin', 'update-demo-access', 'platform', 'platform', 'Updated super admin demo access credentials');
      await writePlatformStore(document);

      return res.json({ success: true, data: document.demoAccess });
    }
  } catch (error) {
    console.error('Failed to update demo access', error);
    return res.status(500).json({ success: false, error: 'Failed to update demo access' });
  }
};

// Platform feature-flag management removed by request.

// Announcements and platform feature-flag management removed by request.

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const getSuperAdminAuditLogs = async (_req: Request, res: Response) => {
  try {
    const dbReady = mongoose.connection.readyState === 1 && isDbConnected();
    if (dbReady) {
      const logs = await SecurityAudit.find({}).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ success: true, data: logs });
    } else {
      const document = await readPlatformStore();
      return res.json({ success: true, data: document.auditLogs });
    }
  } catch (error) {
    console.error('Failed to load audit logs', error);
    return res.status(500).json({ success: false, error: 'Failed to load audit logs' });
  }
};

// ─── Invoices ────────────────────────────────────────────────────────────────

export const getSuperAdminInvoices = async (_req: Request, res: Response) => {
  try {
    const document = await readPlatformStore();
    return res.json({ success: true, data: document.invoices });
  } catch (error) {
    console.error('Failed to load invoices', error);
    return res.status(500).json({ success: false, error: 'Failed to load invoices' });
  }
};

export const createSuperAdminInvoice = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    if (!isPlainObject(payload)) {
      return res.status(400).json({ success: false, error: 'invoice payload must be an object' });
    }

    const storeId = asString(payload.storeId);
    const period = asString(payload.period, 'Monthly');
    const paymentMethod = asString(payload.paymentMethod, 'UPI');

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId is required' });
    }

    const document = await readPlatformStore();
    const store = document.stores.find((item) => item.id === storeId);

    if (!store) {
      return res.status(404).json({ success: false, error: 'store not found' });
    }

    const amount = typeof payload.amount === 'number' && payload.amount > 0
      ? payload.amount
      : planPriceFor(store.planName);

    const dueDate = asString(payload.dueDate, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    const invoice = {
      id: nextInvoiceId(),
      storeId,
      storeName: store.shopName,
      period,
      amount,
      currency: 'INR',
      status: 'ISSUED' as const,
      createdAt: new Date().toISOString(),
      dueDate,
      paymentMethod,
    };

    document.invoices.unshift(invoice);
    await appendAuditLog(document, 'super-admin', 'create-invoice', 'invoice', invoice.id, `Issued invoice for ${store.shopName}`);
    await writePlatformStore(document);

    return res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    console.error('Failed to create invoice', error);
    return res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
};
