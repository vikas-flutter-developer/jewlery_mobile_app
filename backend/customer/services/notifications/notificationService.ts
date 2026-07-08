import nodemailer from "nodemailer";
import { Notification, NotificationPreference } from "../../models/index.js";
import { customerDb, tenantLocalStorage } from "../../../lib/db.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { readPlatformStore } from "../../../lib/platformStore.js";
import { Customer, Design, Inventory, Order, Karikar, Rate, SchemeEnrollment } from "../../models/index.js";

const normalizeRecipients = (input: unknown): string[] => {
  if (typeof input === "string") {
    return input.trim() ? [input.trim()] : [];
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  return [];
};

const normalizeMetadata = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const generateNotificationId = (prefix: string) =>
  `${prefix.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const getStoreId = () => {
  const store = tenantLocalStorage.getStore();
  return store?.tenantId || "default-shop";
};

const getTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && port && user && pass) {
    return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  } catch (error) {
    console.warn("[Notification] Failed to create fallback transporter", error);
    return null;
  }
};

const sendEmail = async (emails: string[], subject: string, body: string) => {
  const transporter = await getTransporter();
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER || "no-reply@aurajewel.com";

  if (!transporter) {
    console.log("[Notification] Email stub: ", { from, to: emails, subject, body });
    return { provider: "local-email-stub", simulated: true };
  }

  try {
    const info = await transporter.sendMail({ from, to: emails.join(", "), subject, text: body, html: `<p>${body}</p>` });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log(`[Notification] Email preview available: ${preview}`);
    }
    return { provider: "smtp", simulated: false };
  } catch (error) {
    console.error("[Notification] Email transport failed", error);
    return { provider: "smtp", simulated: false, error };
  }
};

const sendWhatsapp = async (phones: string[], message: string) => {
  const provider = process.env.WHATSAPP_BUSINESS_PROVIDER || "WhatsApp Business";
  const apiKey = process.env.WHATSAPP_BUSINESS_API_KEY;

  if (!apiKey) {
    console.log("[Notification] WhatsApp stub: ", { provider: "local-whatsapp-stub", phones, message });
    return { provider: "local-whatsapp-stub", simulated: true };
  }

  // Placeholder for real WhatsApp provider integration.
  console.log("[Notification] WhatsApp queued", { provider, phones, message });
  return { provider, simulated: false };
};

export const notificationService = {
  async enqueueNotification(payload: {
    type: string;
    title: string;
    message: string;
    category?: string;
    severity?: "INFO" | "WARNING" | "CRITICAL";
    channels?: string[];
    recipientEmails?: unknown;
    recipientPhones?: unknown;
    metadata?: unknown;
    reference?: string;
    relatedEntityId?: string;
    sendAt?: string | Date;
  }) {
    const storeId = getStoreId();
    const recipientEmails = normalizeRecipients(payload.recipientEmails);
    const recipientPhones = normalizeRecipients(payload.recipientPhones);
    const notification = await Notification.create({
      notificationId: generateNotificationId(payload.type || "NOTIF"),
      tenantId: storeId,
      storeId,
      type: payload.type || "GENERAL",
      title: payload.title,
      message: payload.message,
      category: payload.category || "General",
      severity: payload.severity || "INFO",
      channels: payload.channels || ["IN_APP"],
      recipientEmails,
      recipientPhones,
      metadata: normalizeMetadata(payload.metadata),
      reference: payload.reference,
      relatedEntityId: payload.relatedEntityId,
      sendAt: payload.sendAt ? new Date(payload.sendAt) : new Date(),
      status: "PENDING",
    });

    return notification;
  },

  async processPendingNotifications() {
    if (!isDbConnected()) {
      return [];
    }

    const now = new Date();
    const notifications = await Notification.find({
      status: "PENDING",
      sendAt: { $lte: now },
    }).sort({ sendAt: 1 }).limit(50);

    const results: any[] = [];
    for (const notification of notifications) {
      let hasExternalChannel = false;
      let simulated = false;
      let anyError = false;

      if (notification.channels.includes("EMAIL") && notification.recipientEmails.length) {
        hasExternalChannel = true;
        const emailSend = await sendEmail(notification.recipientEmails, notification.title, notification.message);
        simulated = simulated || !!emailSend.simulated;
        if ((emailSend as any).error) anyError = true;
      }

      if (notification.channels.includes("WHATSAPP") && notification.recipientPhones.length) {
        hasExternalChannel = true;
        const whatsappSend = await sendWhatsapp(notification.recipientPhones, notification.message);
        simulated = simulated || !!whatsappSend.simulated;
        if ((whatsappSend as any).error) anyError = true;
      }

      const status = anyError ? "FAILED" : hasExternalChannel ? (simulated ? "SIMULATED" : "SENT") : "SENT";
      notification.status = status;
      notification.deliveredAt = new Date();
      await notification.save();
      results.push({ id: notification.notificationId, status });
    }

    return results;
  },

  async markAsRead(notificationId: string) {
    const notification = await Notification.findOneAndUpdate(
      { notificationId },
      { readAt: new Date() },
      { new: true }
    );
    return notification;
  },

  async getNotifications(filter: Record<string, unknown> = {}, limit = 50, page = 1) {
    const storeId = getStoreId();
    const query = { storeId, ...filter };
    const skip = Math.max(page - 1, 0) * limit;
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await Notification.countDocuments(query);
    return { total, page, limit, notifications };
  },

  async getPreferences(ownerType = "STORE", ownerId?: string) {
    const resolvedOwnerId = ownerId || getStoreId();
    let preferences = await NotificationPreference.findOne({ ownerType, ownerId: resolvedOwnerId }).lean();
    if (!preferences) {
      preferences = {
        ownerType,
        ownerId: resolvedOwnerId,
        channels: { email: true, whatsapp: true, inApp: true },
        categories: [],
        language: "en",
      };
    }
    return preferences;
  },

  async updatePreferences(payload: {
    ownerType?: "STORE" | "USER";
    ownerId?: string;
    channels?: { email?: boolean; whatsapp?: boolean; inApp?: boolean };
    categories?: string[];
    language?: string;
  }) {
    const ownerType = payload.ownerType || "STORE";
    const ownerId = payload.ownerId || getStoreId();

    const existing = await NotificationPreference.findOne({ ownerType, ownerId });
    if (existing) {
      existing.channels = {
        email: payload.channels?.email ?? existing.channels.email,
        whatsapp: payload.channels?.whatsapp ?? existing.channels.whatsapp,
        inApp: payload.channels?.inApp ?? existing.channels.inApp,
      };
      existing.categories = Array.isArray(payload.categories) ? payload.categories : existing.categories;
      existing.language = payload.language || existing.language;
      await existing.save();
      return existing;
    }

    const created = await NotificationPreference.create({
      ownerType,
      ownerId,
      channels: {
        email: payload.channels?.email ?? true,
        whatsapp: payload.channels?.whatsapp ?? true,
        inApp: payload.channels?.inApp ?? true,
      },
      categories: Array.isArray(payload.categories) ? payload.categories : [],
      language: payload.language || "en",
    });

    return created;
  },

  async generateScheduledNotifications() {
    if (!isDbConnected()) {
      return [];
    }

    const now = new Date();
    const results: any[] = [];

    const createIfMissing = async (payload: {
      notificationId: string;
      title: string;
      message: string;
      category: string;
      type: string;
      severity: "INFO" | "WARNING" | "CRITICAL";
      recipientEmails?: string[];
      recipientPhones?: string[];
      channels?: string[];
      reference?: string;
      relatedEntityId?: string;
      sendAt?: Date;
    }) => {
      const existing = await Notification.findOne({ notificationId: payload.notificationId });
      if (existing) return null;
      const notification = await Notification.create({
        notificationId: payload.notificationId,
        tenantId: getStoreId(),
        storeId: getStoreId(),
        type: payload.type,
        title: payload.title,
        message: payload.message,
        category: payload.category,
        severity: payload.severity,
        channels: payload.channels || ["IN_APP"],
        recipientEmails: payload.recipientEmails || [],
        recipientPhones: payload.recipientPhones || [],
        metadata: {},
        reference: payload.reference,
        relatedEntityId: payload.relatedEntityId,
        sendAt: payload.sendAt || now,
        status: "PENDING",
      });
      results.push(notification.notificationId);
      return notification;
    };

    const schemeReminderWindowDays = 7;
    const lowStockThreshold = 1;
    const orderDueWindowDays = 15;
    const overdueWindowDays = 0;

    const orders = await Order.find({}).lean();
    orders.forEach((order: any) => {
      const neededDate = order.neededDate ? new Date(order.neededDate) : order.deadline ? new Date(order.deadline) : null;
      if (!neededDate) return;
      const delta = Math.ceil((neededDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (delta >= 0 && delta <= orderDueWindowDays && ["PENDING", "IN_PROGRESS", "OPEN", "AWAITING_APPROVAL", "PROCESSING"].includes(String(order.status || "").toUpperCase())) {
        createIfMissing({
          notificationId: `ORDER_DUE_${order._id || order.orderId}`,
          type: "ORDER_DUE",
          title: `Order due soon ${order.orderId || order._id}`,
          message: `Delivery due in ${delta} days for ${order.customerName || "a customer"}`,
          category: "Orders",
          severity: "WARNING",
          reference: order._id || order.orderId,
          relatedEntityId: String(order._id || order.orderId),
          sendAt: now,
        });
      }
    });

    const karikars = await Karikar.find({}).lean();
    for (const karikar of karikars) {
      if (!Array.isArray(karikar.jobCards)) continue;
      for (const job of karikar.jobCards) {
        const dueDate = job.dueDate ? new Date(job.dueDate) : null;
        if (!dueDate) continue;
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= overdueWindowDays && String(job.status || "").toUpperCase() !== "COMPLETED") {
          createIfMissing({
            notificationId: `KARIKAR_OVERDUE_${job._id || job.orderId}`,
            type: "KARIKAR_OVERDUE",
            title: `Karikar job overdue ${job.orderId || job._id}`,
            message: `Job for ${karikar.name || "a karikar"} is overdue by ${Math.abs(daysUntil)} days`,
            category: "Production",
            severity: "CRITICAL",
            reference: job._id || job.orderId,
            relatedEntityId: String(job._id || job.orderId),
          });
        }
      }
    }

    const schemeEnrollments = await SchemeEnrollment.find({}).lean();
    for (const enrollment of schemeEnrollments) {
      if (!Array.isArray(enrollment.installments)) continue;
      for (const installment of enrollment.installments) {
        const dueDate = installment.dueDate ? new Date(installment.dueDate) : null;
        if (!dueDate) continue;
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= 0 && daysUntil <= schemeReminderWindowDays && String(installment.status || "").toUpperCase() === "PENDING") {
          createIfMissing({
            notificationId: `SCHEME_REMINDER_${installment.installmentId || enrollment.enrollmentId}`,
            type: "SCHEME_REMINDER",
            title: `Scheme installment due for ${enrollment.customerName}`,
            message: `Installment due in ${daysUntil} days for ${enrollment.schemeName}`,
            category: "Schemes",
            severity: "INFO",
            recipientPhones: [enrollment.customerPhone],
            channels: ["IN_APP", "WHATSAPP"],
            reference: enrollment.enrollmentId,
            relatedEntityId: String(enrollment.enrollmentId),
          });
        }
      }
    }

    const designs = await Design.find({}).lean();
    const inventoryItems = await Inventory.find({ status: "In Stock" }).lean();
    const stockByDesign = new Map<string, any[]>();
    inventoryItems.forEach((item: any) => {
      const key = String(item.designCode || item.designCode || "").trim();
      const existing = stockByDesign.get(key) || [];
      existing.push(item);
      stockByDesign.set(key, existing);
    });

    designs.forEach((design: any) => {
      const currentStock = stockByDesign.get(String(design.designCode || ""))?.length || 0;
      const threshold = typeof design.minStockThreshold === "number" ? design.minStockThreshold : lowStockThreshold;
      if (currentStock < threshold) {
        createIfMissing({
          notificationId: `LOW_STOCK_${design.designCode}`,
          type: "LOW_STOCK",
          title: `Low stock for ${design.name}`,
          message: `${currentStock} items available, threshold is ${threshold}`,
          category: "Inventory",
          severity: currentStock === 0 ? "CRITICAL" : "WARNING",
          reference: String(design.designCode),
          relatedEntityId: String(design.designCode),
        });
      }
    });

    const platformStore = await readPlatformStore();
    if (Array.isArray(platformStore.stores)) {
      platformStore.stores.forEach((store) => {
        if (!store.subscriptionExpiry) return;
        const expiryDate = new Date(store.subscriptionExpiry);
        if (!Number.isFinite(expiryDate.getTime())) return;
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
          createIfMissing({
            notificationId: `SUBSCRIPTION_EXPIRY_${store.id}`,
            type: "SUBSCRIPTION_EXPIRY",
            title: `Subscription expiring soon for ${store.shopName}`,
            message: `Expiry in ${daysUntilExpiry} days for ${store.shopName}`,
            category: "Subscriptions",
            severity: daysUntilExpiry === 0 ? "CRITICAL" : "WARNING",
            recipientEmails: [store.email],
            channels: ["IN_APP", "EMAIL"],
            reference: store.id,
            relatedEntityId: store.id,
          });
        }
      });
    }

    return results;
  },
};
