import fs from "fs";
import path from "path";

export interface PlatformFeatureFlags {
  enableSuperAdmin: boolean;
  enableBilling: boolean;
  enableInvoiceGeneration: boolean;
  enableNotifications: boolean;
  enableOldGold: boolean;
  enableSchemes: boolean;
  enableCatalog: boolean;
  enableMultiBranch: boolean;
  maintenanceMode?: boolean;
  maxUploadSize?: number;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  audience: 'ALL_ADMINS' | 'ALL_STORES' | 'SUPER_ADMIN';
  createdAt: string;
  publishAt: string;
  author: string;
}

export interface PlatformAuditLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface PlatformInvoice {
  id: string;
  storeId: string;
  storeName: string;
  period: string;
  amount: number;
  currency: string;
  status: 'ISSUED' | 'PAID' | 'FAILED';
  createdAt: string;
  dueDate: string;
  paymentMethod: string;
}

export interface PlatformDemoAccess {
  email: string;
  password: string;
  otp: string;
  updatedAt: string;
}

export interface PlatformStoreRecord {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  gstNumber: string;
  panNumber: string;
  aadharNumber: string;
  address: string;
  planName: string;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'PENDING' | 'SUSPENDED';
  paymentMethod: 'CASH' | 'CHECK' | 'UPI' | 'CARD';
  paymentStatus: 'PAID' | 'DUE' | 'FAILED';
  subscriptionExpiry: string;
  joinDate: string;
  lastLogin?: string;
  reminderCount?: number;
  lastReminderAt?: string;
  note: string;
  storeType: 'MANUFACTURER' | 'RETAILER';
  updatedAt: string;
}

export interface PlatformStoreDocument {
  stores: PlatformStoreRecord[];
  featureFlags: PlatformFeatureFlags;
  announcements: PlatformAnnouncement[];
  auditLogs: PlatformAuditLog[];
  invoices: PlatformInvoice[];
  demoAccess: PlatformDemoAccess;
  updatedAt: string;
}

const isBackendCwd = path.basename(process.cwd()) === "backend";
const backendRoot = isBackendCwd ? process.cwd() : path.resolve(process.cwd(), "backend");
const storePath = path.resolve(backendRoot, "data", "platformStore.json");

const defaultFeatureFlags: PlatformFeatureFlags = {
  enableSuperAdmin: true,
  enableBilling: true,
  enableInvoiceGeneration: true,
  enableNotifications: true,
  enableOldGold: false,
  enableSchemes: false,
  enableCatalog: false,
  enableMultiBranch: false,
  maintenanceMode: false,
  maxUploadSize: 10,
};

const defaultAuditLogs: PlatformAuditLog[] = [
  {
    id: "AUDIT-001",
    actor: "system",
    action: "bootstrap",
    entityType: "platform",
    entityId: "platform",
    details: "Seeded platform store and baseline audit trail.",
    createdAt: new Date().toISOString(),
  },
];

const defaultDemoAccess: PlatformDemoAccess = {
  email: 'superadmin@aurajewel.com',
  password: 'superadmin',
  otp: '123456',
  updatedAt: new Date().toISOString(),
};

const planPrices: Record<string, number> = {
  '1MONTH': 4999,
  '3MONTH': 12999,
  '6MONTH': 22999,
  '1YEAR': 39999,
  '2YEAR': 79999,
};

const derivePaymentStatus = (status: PlatformStoreRecord['status'], paymentStatus?: PlatformStoreRecord['paymentStatus']) => {
  if (paymentStatus) {
    return paymentStatus;
  }

  if (status === 'ACTIVE') {
    return 'PAID';
  }

  if (status === 'SUSPENDED') {
    return 'FAILED';
  }

  return 'DUE';
};

const normalizeStatus = (value: unknown): PlatformStoreRecord['status'] => {
  if (value === 'ACTIVE' || value === 'EXPIRED' || value === 'TRIAL' || value === 'PENDING' || value === 'SUSPENDED') {
    return value;
  }

  return 'PENDING';
};

const normalizePlanName = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toUpperCase();
  }

  return '1YEAR';
};

const normalizePaymentMethod = (value: unknown): PlatformStoreRecord['paymentMethod'] => {
  if (value === 'CASH' || value === 'CHECK' || value === 'UPI' || value === 'CARD') {
    return value;
  }

  return 'UPI';
};

const ensureStoreDirectory = () => {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const parseFallbackStore = (): PlatformStoreRecord[] => {
  const isBackendCwd = path.basename(process.cwd()) === "backend";
  const backendRoot = isBackendCwd ? process.cwd() : path.resolve(process.cwd(), "backend");
  const fallbackPath = path.resolve(backendRoot, 'data', 'fallbackStore.json');

  if (!fs.existsSync(fallbackPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(fallbackPath, 'utf8');
    const parsed = JSON.parse(raw) as { shops?: Array<Record<string, unknown>>; users?: Array<Record<string, unknown>> };
    const shops = Array.isArray(parsed.shops) ? parsed.shops : [];
    const users = Array.isArray(parsed.users) ? parsed.users : [];

    const userMap = new Map<string, Record<string, unknown>>();
    for (const user of users) {
      const tenantId = typeof user.tenantId === 'string' ? user.tenantId : '';
      if (tenantId) {
        userMap.set(tenantId, user);
      }
    }

    return shops.map((shop) => {
      const id = typeof shop.id === 'string' ? shop.id : `shop-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const user = userMap.get(id);
      const subscriptionExpiry = typeof shop.subscriptionExpiry === 'string' ? shop.subscriptionExpiry : new Date().toISOString();
      const planName = normalizePlanName(shop.planName);
      const status = normalizeStatus(shop.subscriptionStatus);
      const paymentStatus = derivePaymentStatus(status);
      const paymentMethod = normalizePaymentMethod(shop.paymentMethod);
      const createdAt = typeof user?.createdAt === 'string' ? user.createdAt : new Date().toISOString();
      const lastLogin = typeof user?.lastLogin === 'string' ? user.lastLogin : undefined;
      const reminderCount = typeof shop.reminderCount === 'number' ? shop.reminderCount : 0;
      const lastReminderAt = typeof shop.lastReminderAt === 'string' ? shop.lastReminderAt : undefined;

      const email = typeof user?.email === 'string' ? user.email : `owner-${id}@aurajewel.com`;
      const isManufacturer = email === 'manufacturer@aurajewel.com' || user?.role === 'ADMIN';

      return {
        id,
        shopName: typeof shop.shopName === 'string' ? shop.shopName : 'Unnamed Shop',
        ownerName: typeof user?.name === 'string' ? user.name : 'Owner',
        email,
        phone: typeof shop.phone === 'string' ? shop.phone : '',
        gstNumber: typeof shop.gstNumber === 'string' ? shop.gstNumber : '',
        panNumber: typeof shop.panNumber === 'string' ? shop.panNumber : '',
        aadharNumber: typeof shop.aadharNumber === 'string' ? shop.aadharNumber : '',
        address: typeof shop.address === 'string' ? shop.address : '',
        planName,
        status,
        paymentMethod,
        paymentStatus,
        subscriptionExpiry,
        joinDate: createdAt,
        lastLogin,
        reminderCount,
        lastReminderAt,
        note: status === 'ACTIVE' ? 'Seeded from fallback store' : 'Needs review',
        storeType: isManufacturer ? 'MANUFACTURER' : 'RETAILER',
        updatedAt: createdAt,
      };
    });
  } catch (error) {
    console.error('Failed to parse fallback store for platform store seed', error);
    return [];
  }
};

const createDefaultDocument = (): PlatformStoreDocument => {
  const seededStores = parseFallbackStore();

  return {
    stores: seededStores,
    featureFlags: { ...defaultFeatureFlags },
    announcements: [],
    auditLogs: [...defaultAuditLogs],
    invoices: [],
    demoAccess: { ...defaultDemoAccess },
    updatedAt: new Date().toISOString(),
  };
};

const mergeSeededStores = (document: PlatformStoreDocument): PlatformStoreDocument => {
  const seeded = parseFallbackStore();
  const existingMap = new Map(document.stores.map((store) => [store.id, store]));

  for (const store of seeded) {
    if (!existingMap.has(store.id)) {
      document.stores.push(store);
    }
  }

  document.stores.sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());
  return document;
};

export const readPlatformStore = async (): Promise<PlatformStoreDocument> => {
  ensureStoreDirectory();

  if (!fs.existsSync(storePath)) {
    const document = createDefaultDocument();
    await fs.promises.writeFile(storePath, JSON.stringify(document, null, 2), 'utf8');
    return document;
  }

  try {
    const raw = await fs.promises.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PlatformStoreDocument>;
    const rawStores = Array.isArray(parsed.stores) ? parsed.stores : [];
    const document: PlatformStoreDocument = {
      stores: rawStores.map((s: any) => ({
        ...s,
        storeType: s.storeType || (s.email === 'manufacturer@aurajewel.com' ? 'MANUFACTURER' : 'RETAILER'),
      })),
      featureFlags: parsed.featureFlags && typeof parsed.featureFlags === 'object' ? { ...defaultFeatureFlags, ...parsed.featureFlags } : { ...defaultFeatureFlags },
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [...defaultAuditLogs],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      demoAccess: parsed.demoAccess && typeof parsed.demoAccess === 'object'
        ? { ...defaultDemoAccess, ...parsed.demoAccess }
        : { ...defaultDemoAccess },
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };

    const merged = mergeSeededStores(document);
    if (merged.stores.length !== document.stores.length) {
      await writePlatformStore(merged);
      return merged;
    }

    return merged;
  } catch (error) {
    console.error('Failed to read platform store, rehydrating defaults', error);
    const document = createDefaultDocument();
    await fs.promises.writeFile(storePath, JSON.stringify(document, null, 2), 'utf8');
    return document;
  }
};

export const writePlatformStore = async (document: PlatformStoreDocument): Promise<PlatformStoreDocument> => {
  ensureStoreDirectory();
  const nextDocument = {
    ...document,
    updatedAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(storePath, JSON.stringify(nextDocument, null, 2), 'utf8');
  return nextDocument;
};

export const planPriceFor = (planName: string) => {
  return planPrices[planName.toUpperCase()] ?? planPrices['1YEAR'];
};

export const getPlanLabel = (planName: string) => {
  const normalized = planName.toUpperCase();
  if (normalized === '1MONTH') return '1 Month';
  if (normalized === '3MONTH') return '3 Months';
  if (normalized === '6MONTH') return '6 Months';
  if (normalized === '1YEAR') return '1 Year';
  if (normalized === '2YEAR') return '2 Years';
  return planName;
};

export const statusBadgeClass = (status: PlatformStoreRecord['status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/15 text-emerald-200';
    case 'TRIAL':
      return 'bg-amber-500/15 text-amber-100';
    case 'PENDING':
      return 'bg-sky-500/15 text-sky-100';
    case 'SUSPENDED':
      return 'bg-rose-500/15 text-rose-100';
    default:
      return 'bg-slate-700 text-slate-100';
  }
};

export const paymentBadgeClass = (paymentStatus: PlatformStoreRecord['paymentStatus']) => {
  switch (paymentStatus) {
    case 'PAID':
      return 'bg-emerald-500/15 text-emerald-100';
    case 'DUE':
      return 'bg-amber-500/15 text-amber-100';
    case 'FAILED':
      return 'bg-rose-500/15 text-rose-100';
    default:
      return 'bg-slate-700 text-slate-100';
  }
};
