import { Request, Response } from "express";
import { Customer, Design, Inventory, Order, Karikar, Rate, SchemeEnrollment } from "../../../models/index.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { readPlatformStore } from "../../../lib/platformStore.js";
import { notificationService } from "../../services/notifications/notificationService.js";
import { mockDesigns, mockInventory, mockRates } from "../../../data/mockData.js";

interface WhatsappTemplateRequest {
  to?: string | string[];
  templateName?: string;
  language?: string;
  channel?: string;
  components?: unknown[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
  branchId?: string;
  sendAt?: string;
}

interface StoredWhatsappTemplateRequest {
  requestId: string;
  channel: string;
  to: string[];
  templateName: string;
  language: string;
  components: unknown[];
  metadata: Record<string, unknown>;
  branchId?: string;
  createdBy?: string;
  sendAt?: string;
  status: string;
  createdAt: string;
  provider: string;
}

interface StoredEmailInvoiceRequest {
  requestId: string;
  to: string[];
  subject: string;
  body: string;
  metadata: Record<string, unknown>;
  status: string;
  createdAt: string;
  provider: string;
}

const whatsappTemplateRequests: StoredWhatsappTemplateRequest[] = [];
const emailInvoiceRequests: StoredEmailInvoiceRequest[] = [];

const normalizeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  return fallback;
};

const normalizeRecipients = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  return [];
};

const normalizeComponents = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
};

const normalizeMetadata = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const generateRequestId = () => `WTP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const generateEmailRequestId = () => `EML-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;


export const sendWhatsappBusinessMessage = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as WhatsappTemplateRequest;
    const recipients = normalizeRecipients(body.to);
    const templateName = normalizeString(body.templateName);
    const provider = normalizeString(process.env.WHATSAPP_BUSINESS_PROVIDER || "WhatsApp Business");
    const apiKey = normalizeString(process.env.WHATSAPP_BUSINESS_API_KEY);

    if (!recipients.length) {
      return res.status(400).json({ success: false, error: "to is required" });
    }
    if (!templateName) {
      return res.status(400).json({ success: false, error: "templateName is required" });
    }

    const message = {
      requestId: generateRequestId(),
      channel: "whatsapp_business",
      to: recipients,
      templateName,
      language: normalizeString(body.language, "en"),
      components: normalizeComponents(body.components),
      metadata: normalizeMetadata(body.metadata),
      branchId: normalizeString(body.branchId) || undefined,
      createdBy: normalizeString(body.createdBy) || undefined,
      status: apiKey ? "QUEUED" : "SIMULATED",
      provider: apiKey ? provider : "local-whatsapp-stub",
      createdAt: new Date().toISOString(),
      apiKeyConfigured: Boolean(apiKey),
    } as any;

    const enqueued = await notificationService.enqueueNotification({
      type: "WHATSAPP_BUSINESS",
      title: `WhatsApp business message for ${recipients.join(", ")}`,
      message: `Template ${templateName} sent via WhatsApp Business`,
      category: "Communication",
      severity: "INFO",
      channels: ["WHATSAPP"],
      recipientPhones: recipients,
      metadata: {
        templateName,
        language: normalizeString(body.language, "en"),
        components: normalizeComponents(body.components),
        branchId: normalizeString(body.branchId) || undefined,
        createdBy: normalizeString(body.createdBy) || undefined,
        apiKeyConfigured: Boolean(apiKey),
      },
    });

    return res.status(201).json({
      success: true,
      message: apiKey ? "WhatsApp Business message queued" : "WhatsApp Business message stubbed; API key not configured",
      data: enqueued,
    });
  } catch (error) {
    console.error("Failed to send WhatsApp Business message", error);
    return res.status(500).json({ success: false, error: "Failed to send WhatsApp Business message" });
  }
};

export const sendInvoiceEmail = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as any;
    const recipients = normalizeRecipients(body.to);
    const subject = normalizeString(body.subject);
    const emailBody = normalizeString(body.body);

    if (!recipients.length) {
      return res.status(400).json({ success: false, error: 'to is required' });
    }
    if (!subject) {
      return res.status(400).json({ success: false, error: 'subject is required' });
    }
    if (!emailBody) {
      return res.status(400).json({ success: false, error: 'body is required' });
    }

    const enqueued = await notificationService.enqueueNotification({
      type: "INVOICE_EMAIL",
      title: subject,
      message: emailBody,
      category: "Invoices",
      severity: "INFO",
      channels: ["EMAIL"],
      recipientEmails: recipients,
      metadata: {
        ...normalizeMetadata(body.metadata),
        invoice: true,
      },
    });

    console.log('Queued invoice email:', enqueued);

    return res.status(201).json({
      success: true,
      message: 'Invoice email queued',
      data: enqueued,
    });
  } catch (error) {
    console.error('Failed to send invoice email', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send invoice email',
    });
  }
};

export const sendWhatsappTemplate = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as WhatsappTemplateRequest;
    const recipients = normalizeRecipients(body.to);
    const templateName = normalizeString(body.templateName);

    if (!recipients.length) {
      return res.status(400).json({ success: false, error: "to is required" });
    }
    if (!templateName) {
      return res.status(400).json({ success: false, error: "templateName is required" });
    }

    const enqueued = await notificationService.enqueueNotification({
      type: "WHATSAPP_TEMPLATE",
      title: `WhatsApp template ${templateName}`,
      message: `Template ${templateName} queued for ${recipients.join(", ")}`,
      category: "Communication",
      severity: "INFO",
      channels: ["WHATSAPP"],
      recipientPhones: recipients,
      metadata: {
        templateName,
        language: normalizeString(body.language, "en"),
        components: normalizeComponents(body.components),
        branchId: normalizeString(body.branchId) || undefined,
        createdBy: normalizeString(body.createdBy) || undefined,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Whatsapp template queued",
      data: enqueued,
    });
  } catch (error) {
    console.error("Failed to send whatsapp template", error);
    return res.status(500).json({ success: false, error: "Failed to send whatsapp template" });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const page = Number(req.query.page) || 1;
    const status = String(req.query.status || "").trim();
    const category = String(req.query.category || "").trim();
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status.toUpperCase();
    if (category) filter.category = category;

    const data = await notificationService.getNotifications(filter, limit, page);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Failed to fetch notifications", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch notifications" });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) {
      return res.status(400).json({ success: false, error: "notification id is required" });
    }
    const updated = await notificationService.markAsRead(notificationId);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification marked as read", data: updated });
  } catch (error: any) {
    console.error("Failed to mark notification read", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to mark notification read" });
  }
};

export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const ownerType = String(req.query.ownerType || "STORE").toUpperCase() as "STORE" | "USER";
    const ownerId = String(req.query.ownerId || "").trim();
    const preferences = await notificationService.getPreferences(ownerType, ownerId || undefined);
    return res.json({ success: true, data: preferences });
  } catch (error: any) {
    console.error("Failed to fetch notification preferences", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch notification preferences" });
  }
};

export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const payload = {
      ownerType: String(req.body.ownerType || "STORE").toUpperCase() as "STORE" | "USER",
      ownerId: String(req.body.ownerId || "").trim(),
      channels: req.body.channels,
      categories: Array.isArray(req.body.categories) ? req.body.categories.map((category: unknown) => String(category)) : undefined,
      language: String(req.body.language || "en"),
    };
    const updated = await notificationService.updatePreferences(payload);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Failed to update notification preferences", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update notification preferences" });
  }
};

export const getWhatsappTemplateRequests = () => [...whatsappTemplateRequests];

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime() as number) ? date : null;
};

const daysBetween = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const createAlert = (payload: {
  id: string;
  type: string;
  title: string;
  message: string;
  category: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  reference?: string;
  createdAt?: string;
}) => ({
  id: payload.id,
  type: payload.type,
  title: payload.title,
  message: payload.message,
  category: payload.category,
  severity: payload.severity,
  reference: payload.reference,
  createdAt: payload.createdAt || new Date().toISOString(),
});

const getUpcomingBirthday = (dateValue: unknown, windowDays = 7) => {
  const birthdayDate = toDate(dateValue);
  if (!birthdayDate) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const birthdayThisYear = new Date(currentYear, birthdayDate.getMonth(), birthdayDate.getDate());
  const birthdayNextYear = new Date(currentYear + 1, birthdayDate.getMonth(), birthdayDate.getDate());
  const candidate = birthdayThisYear >= now ? birthdayThisYear : birthdayNextYear;
  const daysUntil = daysBetween(now, candidate);

  return daysUntil <= windowDays ? { nextDate: candidate, daysUntil } : null;
};

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const alerts: any[] = [];
    const now = new Date();
    const soonWindowDays = 7;
    const overdueWindowDays = 0;
    const orderDueWindowDays = 15;
    const schemeReminderWindowDays = 7;
    const rateSpikeThreshold = 5;

    let designs: any[] = [];
    let inventoryItems: any[] = [];
    let orders: any[] = [];
    let karikars: any[] = [];
    let customers: any[] = [];
    let rates: any[] = [];

    if (isDbConnected()) {
      designs = await Design.find({}).lean();
      inventoryItems = await Inventory.find({}).lean();
      orders = await Order.find({}).lean();
      karikars = await Karikar.find({}).lean();
      customers = await Customer.find({}).lean();
      rates = await Rate.find({}).sort({ updatedAt: -1 }).lean();
    } else {
      designs = mockDesigns;
      inventoryItems = mockInventory;
      orders = [];
      karikars = [];
      customers = [];
      rates = mockRates.map((rate) => ({ ...rate, updatedAt: new Date().toISOString() }));
    }

    const stockItemsByDesign = new Map<string, any[]>();
    inventoryItems.filter(item => String(item.status).toLowerCase() === "in stock").forEach(item => {
      const key = String(item.designCode || item.designCode).trim();
      const existing = stockItemsByDesign.get(key) || [];
      existing.push(item);
      stockItemsByDesign.set(key, existing);
    });

    for (const design of designs) {
      const currentStock = stockItemsByDesign.get(String(design.designCode))?.length || 0;
      const threshold = typeof design.minStockThreshold === "number" ? design.minStockThreshold : 1;
      if (currentStock < threshold) {
        alerts.push(createAlert({
          id: `LOW_STOCK_${design.designCode}`,
          type: "LOW_STOCK",
          title: `Low stock for ${design.name}`,
          message: `${currentStock} items available, threshold is ${threshold}`,
          category: "Inventory",
          severity: currentStock === 0 ? "CRITICAL" : "WARNING",
          reference: String(design.designCode),
        }));
      }
    }

    const pendingOrderStatuses = ["PENDING", "IN_PROGRESS", "OPEN", "AWAITING_APPROVAL", "PROCESSING"];
    const ordersDueSoon = orders.filter(order => {
      const neededDate = toDate(order.neededDate || order.deadline);
      if (!neededDate) return false;
      const daysUntil = daysBetween(now, neededDate);
      return daysUntil >= 0 && daysUntil <= orderDueWindowDays && pendingOrderStatuses.includes(String(order.status || "").toUpperCase());
    });

    ordersDueSoon.forEach(order => {
      const neededDate = toDate(order.neededDate || order.deadline);
      const daysUntil = neededDate ? daysBetween(now, neededDate) : null;
      alerts.push(createAlert({
        id: `ORDER_DUE_${order._id || order.orderId}`,
        type: "ORDER_DUE",
        title: `Order due soon ${order.orderId || order._id}`,
        message: `Delivery due in ${daysUntil ?? "soon"} days for ${order.customerName || "a customer"}`,
        category: "Orders",
        severity: "WARNING",
        reference: order._id || order.orderId,
      }));
    });

    const overdueKarikarJobs = [];
    for (const karikar of karikars) {
      if (!Array.isArray(karikar.jobCards)) continue;
      for (const job of karikar.jobCards) {
        const dueDate = toDate(job.dueDate);
        if (!dueDate) continue;
        const daysUntil = daysBetween(now, dueDate);
        if (daysUntil <= overdueWindowDays && String(job.status || "").toUpperCase() !== "COMPLETED") {
          overdueKarikarJobs.push({ karikar, job, daysUntil });
        }
      }
    }

    overdueKarikarJobs.forEach(({ karikar, job, daysUntil }) => {
      alerts.push(createAlert({
        id: `KARIKAR_OVERDUE_${job._id || job.orderId}`,
        type: "KARIKAR_OVERDUE",
        title: `Karikar job overdue ${job.orderId || job._id}`,
        message: `Job for ${karikar.name || "a karikar"} is overdue by ${Math.abs(daysUntil)} days`,
        category: "Production",
        severity: "CRITICAL",
        reference: job._id || job.orderId,
      }));
    });

    if (isDbConnected()) {
      const schemeEnrollments = await SchemeEnrollment.find({}).lean();
      schemeEnrollments.forEach(enrollment => {
        if (!Array.isArray(enrollment.installments)) return;
        enrollment.installments.forEach((installment: any) => {
          const dueDate = toDate(installment.dueDate);
          if (!dueDate) return;
          const daysUntil = daysBetween(now, dueDate);
          if (daysUntil >= 0 && daysUntil <= schemeReminderWindowDays && String(installment.status || "").toUpperCase() === "PENDING") {
            alerts.push(createAlert({
              id: `SCHEME_REMINDER_${installment.installmentId || enrollment.enrollmentId}`,
              type: "SCHEME_REMINDER",
              title: `Scheme installment due for ${enrollment.customerName}`,
              message: `Installment due in ${daysUntil} days for ${enrollment.schemeName}`,
              category: "Schemes",
              severity: "INFO",
              reference: enrollment.enrollmentId,
            }));
          }
        });
      });
    }

    customers.forEach(customer => {
      const upcoming = getUpcomingBirthday(customer.birthday, soonWindowDays);
      if (upcoming) {
        alerts.push(createAlert({
          id: `BIRTHDAY_${customer._id || customer.phone}`,
          type: "BIRTHDAY",
          title: `Customer birthday soon: ${customer.name}`,
          message: `Birthday in ${upcoming.daysUntil} days for ${customer.name}`,
          category: "Customers",
          severity: "INFO",
          reference: customer._id || customer.phone,
        }));
      }
    });

    const platformStore = await readPlatformStore();
    if (Array.isArray(platformStore.stores)) {
      platformStore.stores.forEach((store) => {
        if (!store.subscriptionExpiry) return;
        const expiryDate = toDate(store.subscriptionExpiry);
        if (!expiryDate) return;
        const daysUntilExpiry = daysBetween(now, expiryDate);
        if (daysUntilExpiry >= 0 && daysUntilExpiry <= soonWindowDays) {
          alerts.push(createAlert({
            id: `SUBSCRIPTION_EXPIRY_${store.id}`,
            type: "SUBSCRIPTION_EXPIRY",
            title: `Subscription expiring soon for ${store.shopName}`,
            message: `Expiry in ${daysUntilExpiry} days for ${store.shopName}`,
            category: "Subscriptions",
            severity: daysUntilExpiry === 0 ? "CRITICAL" : "WARNING",
            reference: store.id,
          }));
        }
      });
    }

    const groupedRates = rates.reduce((map, rate) => {
      const key = String(rate.metal).toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rate);
      return map;
    }, new Map<string, any[]>());

    groupedRates.forEach((history, metal) => {
      if (history.length < 2) return;
      const [latest, previous] = history;
      const latestRate = Number(latest.rate || 0);
      const previousRate = Number(previous.rate || 0);
      if (!previousRate || previousRate <= 0) return;
      const change = ((latestRate - previousRate) / previousRate) * 100;
      if (Math.abs(change) >= rateSpikeThreshold) {
        alerts.push(createAlert({
          id: `RATE_SPIKE_${metal}`,
          type: "RATE_SPIKE",
          title: `${metal} rate moved ${change.toFixed(1)}%`,
          message: `${metal} moved from ${previousRate} to ${latestRate}`,
          category: "Rates",
          severity: Math.abs(change) >= 10 ? "CRITICAL" : "WARNING",
          reference: metal,
        }));
      }
    });

    return res.json({ success: true, data: alerts });
  } catch (error: any) {
    console.error("Failed to retrieve alerts", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to retrieve alerts" });
  }
};


