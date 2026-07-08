import fs from "fs";
import path from "path";

export interface FallbackUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  tenantId?: string;
  branchId?: string | null;
  status?: string;
  permissions?: string[];
  lastLogin?: string;
  shiftHistory?: Array<{ type: string; timestamp: string }>;
  shiftSchedule?: {
    days: string[];
    timeStart: string;
    timeEnd: string;
    shiftName?: string;
  };
  salesTarget?: number;
  commissionRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FallbackCustomer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  pan?: string;
  aadhar?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  kycStatus?: string;
  kycDocuments?: Array<{ type: string; documentPath: string; uploadedAt: string }>;
  creditLimit?: number;
  loyaltyPoints?: number;
  totalPurchases?: number;
  customerSince?: string;
  ledgerAccountId?: string;
  loyaltyWalletId?: string;
  birthday?: string;
  anniversary?: string;
  referredBy?: string;
  tags?: string[];
  status?: string;
  customerTier?: string;
  preferredBranch?: string;
  vipSince?: string;
  blacklistDate?: string;
  blacklistReason?: string;
  blacklistedBy?: string;
  creditBlocked?: boolean;
  id?: string;
  outstandingBalance?: number;
  tierNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface FallbackVendor {
  _id: string;
  name: string;
  type?: string;
  gstin?: string;
  gst?: string;
  pan?: string;
  phone?: string;
  email?: string;
  bank?: string;
  bankAccount?: string;
  contactPerson?: string;
  notes?: string;
  metalAccount?: {
    goldBalance?: number;
    silverBalance?: number;
    platinumBalance?: number;
  };
  ledgerAccountId?: string;
  minOrderQty?: number;
  minOrderValue?: number;
  rateContracts?: Array<{
    metalType: string;
    lockedRate: number;
    validUntil: string;
  }>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FallbackShop {
  id: string;
  shopName: string;
  gstNumber: string;
  panNumber?: string;
  address: string;
  phone: string;
  subscriptionStatus: string;
  subscriptionExpiry: string;
  planName: string;
}

export interface FallbackGemstoneParcel {
  _id: string;
  parcelNumber: string;
  gemstoneType: string;
  weight: number;
  quantity: number;
  availableWeight: number;
  availableQuantity: number;
  rate: number;
  totalValue: number;
  clarity?: string;
  color?: string;
  shape?: string;
  size?: string;
  status?: string;
  description?: string;
  history?: Array<{
    issuedTo: string;
    orderId?: string;
    quantity: number;
    weight: number;
    notes?: string;
    issuedAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FallbackComment {
  text: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface FallbackTask {
  _id: string;
  title: string;
  description?: string;
  status: string;
  assignedTo?: string;
  createdBy?: string;
  tenantId?: string;
  dueDate?: string;
  deadline?: string;
  comments: FallbackComment[];
  createdAt: string;
  updatedAt: string;
}

export interface FallbackRepairJob {
  _id: string;
  repairJobId: string;
  customerName: string;
  customerPhone: string;
  itemDescription: string;
  estimatedWeight: number;
  issueDate: string;
  dueDate?: string;
  repairCost: number;
  status: string;
  karikarId?: string;
  notes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FallbackStore {
  users: FallbackUser[];
  customers: FallbackCustomer[];
  vendors: FallbackVendor[];
  shops: FallbackShop[];
  gemstoneParcels: FallbackGemstoneParcel[];
  schemeDefinitions: any[];
  schemeEnrollments: any[];
  tasks?: FallbackTask[];
  repairJobs?: FallbackRepairJob[];
  tickets?: any[];
  denominations?: any[];
  schedules?: any[];
  consignmentStock?: any[];
  cheques?: any[];
  retailerOrders?: any[];
  [key: string]: any;
}

const storePath = path.resolve(process.cwd(), "backend", "data", "fallbackStore.json");

const ensureStore = async (): Promise<void> => {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    await fs.promises.writeFile(storePath, JSON.stringify({ 
      users: [], 
      customers: [], 
      vendors: [], 
      shops: [], 
      gemstoneParcels: [], 
      schemeDefinitions: [], 
      schemeEnrollments: [], 
      tasks: [], 
      repairJobs: [],
      tickets: [],
      denominations: [],
      schedules: [],
      consignmentStock: [],
      cheques: [],
      retailerOrders: []
    }, null, 2), "utf8");
  }
};

const readStore = async (): Promise<FallbackStore> => {
  await ensureStore();
  const raw = await fs.promises.readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<FallbackStore>;

  return {
    ...parsed,
    users: Array.isArray(parsed.users) ? parsed.users : [],
    customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
    shops: Array.isArray(parsed.shops) ? parsed.shops : [],
    gemstoneParcels: Array.isArray(parsed.gemstoneParcels) ? parsed.gemstoneParcels : [],
    schemeDefinitions: Array.isArray(parsed.schemeDefinitions) ? parsed.schemeDefinitions : [],
    schemeEnrollments: Array.isArray(parsed.schemeEnrollments) ? parsed.schemeEnrollments : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    repairJobs: Array.isArray(parsed.repairJobs) ? parsed.repairJobs : [],
    tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
    denominations: Array.isArray(parsed.denominations) ? parsed.denominations : [],
    schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    consignmentStock: Array.isArray(parsed.consignmentStock) ? parsed.consignmentStock : [],
    cheques: Array.isArray(parsed.cheques) ? parsed.cheques : [],
    retailerOrders: Array.isArray(parsed.retailerOrders) ? parsed.retailerOrders : [],
  } as FallbackStore;
};

const writeStore = async (store: FallbackStore): Promise<void> => {
  await fs.promises.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
};

export const findFallbackUserByEmail = async (email: string): Promise<FallbackUser | undefined> => {
  const store = await readStore();
  return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
};

export const findFallbackUserByPhone = async (phone: string): Promise<FallbackUser | undefined> => {
  const store = await readStore();
  return store.users.find((user) => user.phone === phone);
};

export const findFallbackUserById = async (id: string): Promise<FallbackUser | undefined> => {
  const store = await readStore();
  return store.users.find((user) => user._id === id);
};

export const getAllFallbackUsers = async (): Promise<FallbackUser[]> => {
  const store = await readStore();
  return store.users;
};

export const addFallbackUser = async (user: FallbackUser): Promise<FallbackUser> => {
  const store = await readStore();
  store.users.push(user);
  await writeStore(store);
  return user;
};

export const updateFallbackUser = async (user: FallbackUser): Promise<FallbackUser> => {
  const store = await readStore();
  const index = store.users.findIndex((entry) => entry._id === user._id);
  if (index === -1) {
    store.users.push(user);
  } else {
    store.users[index] = user;
  }
  await writeStore(store);
  return user;
};

export const deleteFallbackUser = async (id: string): Promise<boolean> => {
  const store = await readStore();
  const index = store.users.findIndex((u) => u._id === id);
  if (index === -1) return false;
  store.users.splice(index, 1);
  await writeStore(store);
  return true;
};

export const deleteFallbackStoreData = async (tenantId: string): Promise<void> => {
  const store = await readStore();
  store.users = store.users.filter((u) => u.tenantId !== tenantId);
  if (store.tasks) {
    store.tasks = store.tasks.filter((t) => t.tenantId !== tenantId);
  }
  if (store.repairJobs) {
    store.repairJobs = store.repairJobs.filter((rj) => rj.tenantId !== tenantId);
  }
  await writeStore(store);
};

export const findFallbackCustomerByPhone = async (phone: string): Promise<FallbackCustomer | undefined> => {
  const store = await readStore();
  return store.customers.find((customer) => customer.phone === phone);
};

export const findFallbackCustomerByPan = async (pan: string): Promise<FallbackCustomer | undefined> => {
  const store = await readStore();
  return store.customers.find((customer) => customer.pan?.toUpperCase() === pan.toUpperCase());
};

export const findFallbackCustomerById = async (id: string): Promise<FallbackCustomer | undefined> => {
  const store = await readStore();
  return store.customers.find((customer) => customer._id === id);
};

export const getAllFallbackCustomers = async (): Promise<FallbackCustomer[]> => {
  const store = await readStore();
  return store.customers;
};

export const addFallbackCustomer = async (customer: FallbackCustomer): Promise<FallbackCustomer> => {
  const store = await readStore();
  store.customers.push(customer);
  await writeStore(store);
  return customer;
};

export const updateFallbackCustomer = async (customer: FallbackCustomer): Promise<FallbackCustomer> => {
  const store = await readStore();
  const index = store.customers.findIndex((entry) => entry._id === customer._id);
  if (index === -1) {
    store.customers.push(customer);
  } else {
    store.customers[index] = customer;
  }
  await writeStore(store);
  return customer;
};

export const searchFallbackCustomers = async (query: string): Promise<FallbackCustomer[]> => {
  const store = await readStore();
  const normalized = query.trim().toLowerCase();

  if (!normalized) return store.customers;

  return store.customers.filter((customer) => {
    const name = customer.name?.toLowerCase() || "";
    const phone = customer.phone?.toLowerCase() || "";
    const email = customer.email?.toLowerCase() || "";
    const pan = customer.pan?.toLowerCase() || "";

    return name.includes(normalized) || phone.includes(normalized) || email.includes(normalized) || pan.includes(normalized);
  });
};

export const findFallbackVendorByPhone = async (phone: string): Promise<FallbackVendor | undefined> => {
  const store = await readStore();
  return store.vendors.find((vendor) => vendor.phone === phone);
};

export const findFallbackVendorById = async (id: string): Promise<FallbackVendor | undefined> => {
  const store = await readStore();
  return store.vendors.find((vendor) => vendor._id === id);
};

export const getAllFallbackVendors = async (): Promise<FallbackVendor[]> => {
  const store = await readStore();
  return store.vendors;
};

export const addFallbackVendor = async (vendor: FallbackVendor): Promise<FallbackVendor> => {
  const store = await readStore();
  store.vendors.push(vendor);
  await writeStore(store);
  return vendor;
};

export const updateFallbackVendor = async (vendor: FallbackVendor): Promise<FallbackVendor> => {
  const store = await readStore();
  const index = store.vendors.findIndex((entry) => entry._id === vendor._id);
  if (index === -1) {
    store.vendors.push(vendor);
  } else {
    store.vendors[index] = vendor;
  }
  await writeStore(store);
  return vendor;
};

export const addFallbackShop = async (shop: FallbackShop): Promise<FallbackShop> => {
  const store = await readStore();
  store.shops.push(shop);
  await writeStore(store);
  return shop;
};

export const findFallbackShopById = async (id: string): Promise<FallbackShop | undefined> => {
  const store = await readStore();
  return store.shops.find((shop) => shop.id === id);
};

export const getAllFallbackGemstoneParcels = async (): Promise<FallbackGemstoneParcel[]> => {
  const store = await readStore();
  return store.gemstoneParcels;
};

export const addFallbackGemstoneParcel = async (parcel: FallbackGemstoneParcel): Promise<FallbackGemstoneParcel> => {
  const store = await readStore();
  store.gemstoneParcels.push(parcel);
  await writeStore(store);
  return parcel;
};

export const updateFallbackGemstoneParcel = async (parcel: FallbackGemstoneParcel): Promise<FallbackGemstoneParcel> => {
  const store = await readStore();
  const index = store.gemstoneParcels.findIndex((entry) => entry._id === parcel._id);
  if (index === -1) {
    store.gemstoneParcels.push(parcel);
  } else {
    store.gemstoneParcels[index] = parcel;
  }
  await writeStore(store);
  return parcel;
};

export const findFallbackGemstoneParcelById = async (id: string): Promise<FallbackGemstoneParcel | undefined> => {
  const store = await readStore();
  return store.gemstoneParcels.find((parcel) => parcel._id === id);
};

export const findFallbackGemstoneParcelByNumber = async (num: string): Promise<FallbackGemstoneParcel | undefined> => {
  const store = await readStore();
  return store.gemstoneParcels.find((parcel) => parcel.parcelNumber.toLowerCase() === num.toLowerCase());
};

export const getAllFallbackSchemes = async (): Promise<any[]> => {
  const store = await readStore();
  return store.schemeDefinitions || [];
};

export const addFallbackScheme = async (scheme: any): Promise<any> => {
  const store = await readStore();
  if (!store.schemeDefinitions) store.schemeDefinitions = [];
  store.schemeDefinitions.push(scheme);
  await writeStore(store);
  return scheme;
};

export const getAllFallbackEnrollments = async (): Promise<any[]> => {
  const store = await readStore();
  return store.schemeEnrollments || [];
};

export const addFallbackEnrollment = async (enrollment: any): Promise<any> => {
  const store = await readStore();
  if (!store.schemeEnrollments) store.schemeEnrollments = [];
  store.schemeEnrollments.push(enrollment);
  await writeStore(store);
  return enrollment;
};

export const updateFallbackEnrollment = async (enrollment: any): Promise<any> => {
  const store = await readStore();
  if (!store.schemeEnrollments) store.schemeEnrollments = [];
  const index = store.schemeEnrollments.findIndex((e) => e.enrollmentId === enrollment.enrollmentId);
  if (index === -1) {
    store.schemeEnrollments.push(enrollment);
  } else {
    store.schemeEnrollments[index] = enrollment;
  }
  await writeStore(store);
  return enrollment;
};

export const getAllFallbackTasks = async (): Promise<FallbackTask[]> => {
  const store = await readStore();
  return store.tasks || [];
};

export const addFallbackTask = async (task: FallbackTask): Promise<FallbackTask> => {
  const store = await readStore();
  if (!store.tasks) store.tasks = [];
  store.tasks.push(task);
  await writeStore(store);
  return task;
};

export const updateFallbackTask = async (task: FallbackTask): Promise<FallbackTask> => {
  const store = await readStore();
  if (!store.tasks) store.tasks = [];
  const index = store.tasks.findIndex((t) => t._id === task._id);
  if (index === -1) {
    store.tasks.push(task);
  } else {
    store.tasks[index] = task;
  }
  await writeStore(store);
  return task;
};

export const findFallbackTaskById = async (id: string): Promise<FallbackTask | undefined> => {
  const store = await readStore();
  return (store.tasks || []).find((t) => t._id === id);
};

export const getAllFallbackRepairJobs = async (): Promise<FallbackRepairJob[]> => {
  const store = await readStore();
  return store.repairJobs || [];
};

export const addFallbackRepairJob = async (job: FallbackRepairJob): Promise<FallbackRepairJob> => {
  const store = await readStore();
  if (!store.repairJobs) store.repairJobs = [];
  store.repairJobs.push(job);
  await writeStore(store);
  return job;
};

export const updateFallbackRepairJob = async (job: FallbackRepairJob): Promise<FallbackRepairJob> => {
  const store = await readStore();
  if (!store.repairJobs) store.repairJobs = [];
  const index = store.repairJobs.findIndex((j) => j._id === job._id || j.repairJobId === job.repairJobId);
  if (index === -1) {
    store.repairJobs.push(job);
  } else {
    store.repairJobs[index] = job;
  }
  await writeStore(store);
  return job;
};

export const findFallbackRepairJobById = async (id: string): Promise<FallbackRepairJob | undefined> => {
  const store = await readStore();
  return (store.repairJobs || []).find((j) => j._id === id || j.repairJobId === id);
};

export const getAllFallbackTickets = async (): Promise<any[]> => {
  const store = await readStore();
  return store.tickets || [];
};

export const addFallbackTicket = async (ticket: any): Promise<any> => {
  const store = await readStore();
  if (!store.tickets) store.tickets = [];
  store.tickets.push(ticket);
  await writeStore(store);
  return ticket;
};

export const updateFallbackTicket = async (ticket: any): Promise<any> => {
  const store = await readStore();
  if (!store.tickets) store.tickets = [];
  const index = store.tickets.findIndex((t) => t._id === ticket._id);
  if (index === -1) {
    store.tickets.push(ticket);
  } else {
    store.tickets[index] = ticket;
  }
  await writeStore(store);
  return ticket;
};

export const getAllFallbackDenominations = async (): Promise<any[]> => {
  const store = await readStore();
  return store.denominations || [];
};

export const addFallbackDenomination = async (denom: any): Promise<any> => {
  const store = await readStore();
  if (!store.denominations) store.denominations = [];
  store.denominations.push(denom);
  await writeStore(store);
  return denom;
};

export const getAllFallbackSchedules = async (): Promise<any[]> => {
  const store = await readStore();
  return store.schedules || [];
};

export const addFallbackSchedule = async (schedule: any): Promise<any> => {
  const store = await readStore();
  if (!store.schedules) store.schedules = [];
  store.schedules.push(schedule);
  await writeStore(store);
  return schedule;
};

export const updateFallbackSchedule = async (schedule: any): Promise<any> => {
  const store = await readStore();
  if (!store.schedules) store.schedules = [];
  const index = store.schedules.findIndex((s) => s.userId === schedule.userId);
  if (index === -1) {
    store.schedules.push(schedule);
  } else {
    store.schedules[index] = schedule;
  }
  await writeStore(store);
  return schedule;
};

export const getAllFallbackConsignments = async (): Promise<any[]> => {
  const store = await readStore();
  return store.consignmentStock || [];
};

export const addFallbackConsignment = async (item: any): Promise<any> => {
  const store = await readStore();
  if (!store.consignmentStock) store.consignmentStock = [];
  store.consignmentStock.push(item);
  await writeStore(store);
  return item;
};

export const updateFallbackConsignment = async (item: any): Promise<any> => {
  const store = await readStore();
  if (!store.consignmentStock) store.consignmentStock = [];
  const index = store.consignmentStock.findIndex((c) => c.consignmentCode === item.consignmentCode);
  if (index === -1) {
    store.consignmentStock.push(item);
  } else {
    store.consignmentStock[index] = item;
  }
  await writeStore(store);
  return item;
};

export const getAllFallbackCheques = async (): Promise<any[]> => {
  const store = await readStore();
  return store.cheques || [];
};

export const addFallbackCheque = async (cheque: any): Promise<any> => {
  const store = await readStore();
  if (!store.cheques) store.cheques = [];
  store.cheques.push(cheque);
  await writeStore(store);
  return cheque;
};

export const updateFallbackCheque = async (cheque: any): Promise<any> => {
  const store = await readStore();
  if (!store.cheques) store.cheques = [];
  const index = store.cheques.findIndex((c) => c._id === cheque._id || c.chequeNumber === cheque.chequeNumber);
  if (index === -1) {
    store.cheques.push(cheque);
  } else {
    store.cheques[index] = cheque;
  }
  await writeStore(store);
  return cheque;
};

export const getAllFallbackRetailerOrders = async (): Promise<any[]> => {
  const store = await readStore();
  return store.retailerOrders || [];
};

export const addFallbackRetailerOrder = async (order: any): Promise<any> => {
  const store = await readStore();
  if (!store.retailerOrders) store.retailerOrders = [];
  store.retailerOrders.push(order);
  await writeStore(store);
  return order;
};

export const updateFallbackRetailerOrder = async (order: any): Promise<any> => {
  const store = await readStore();
  if (!store.retailerOrders) store.retailerOrders = [];
  const index = store.retailerOrders.findIndex((o) => o._id === order._id);
  if (index === -1) {
    store.retailerOrders.push(order);
  } else {
    store.retailerOrders[index] = order;
  }
  await writeStore(store);
  return order;
};
