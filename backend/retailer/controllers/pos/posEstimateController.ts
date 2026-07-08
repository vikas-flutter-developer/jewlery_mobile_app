import { Request, Response } from "express";
import { Customer, Inventory, Khata, Sale, SchemeEnrollment, ChequeEmi } from "../../models/index.js";
import { mockInventory, mockKhata, mockSales, mockAmlLogs } from "../../../data/mockData.js";
import { isDbConnected } from "../../../lib/serverState.js";
import { getAllFallbackEnrollments, updateFallbackEnrollment, getAllFallbackCheques, addFallbackCheque, updateFallbackCheque, getAllFallbackCustomers, updateFallbackCustomer } from "../../../lib/fallbackStore.js";
import { evaluateChargeRules, resolveMakingCharge as evaluateChargeRulesEngine } from "../../../lib/chargeEngine.js";
import { readSettings } from "../../../lib/settingsStore.js";
import {
  processInvoicePayments,
  FinancialValidationError,
  normalizePayments,
  sumPayments as sumFinancialPayments,
} from "../../services/financial/financialEngineService.js";
import {
  validateInvoiceCompliance,
  ComplianceValidationError,
  logComplianceEvent,
} from "../../services/compliance/complianceEngineService.js";

type EstimateItem = {
  barcode: string;
  makingCharge?: number;
};

type OldGoldExchange = {
  weight: number;
  purity: string;
  rate: number;
};

type Payment = {
  method: string;
  amount: number;
};

type EstimateRecord = {
  estimateId: string;
  customerId: string;
  items: EstimateItem[];
  oldGoldExchange?: OldGoldExchange;
  result: {
    subtotal: number;
    tax: number;
    exchangeDiscount: number;
    payable: number;
  };
  createdAt: string;
  status: "draft" | "completed";
};

const estimateRegistry = new Map<string, EstimateRecord>();
const holdRegistry = new Map<string, { invoiceId: string; status: string; heldAt?: string; cancelledAt?: string; reason?: string }>();

const redeemSchemeHelper = async (enrollmentId: string, invoiceId: string) => {
  if (isDbConnected()) {
    await SchemeEnrollment.findOneAndUpdate(
      { enrollmentId },
      { 
        $set: { 
          status: "REDEEMED", 
          redeemedDate: new Date(), 
          redeemedInvoiceId: invoiceId 
        } 
      }
    );
  } else {
    const list = await getAllFallbackEnrollments();
    const enrollment = list.find(e => e.enrollmentId === enrollmentId);
    if (enrollment) {
      enrollment.status = "REDEEMED";
      enrollment.redeemedDate = new Date().toISOString();
      enrollment.redeemedInvoiceId = invoiceId;
      await updateFallbackEnrollment(enrollment);
    }
  }
};

const parseNumeric = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parsePurityFactor = (purity: unknown) => {
  const raw = String(purity ?? "").trim();

  if (!raw) {
    return 1;
  }

  if (raw.endsWith("%")) {
    const parsed = parseNumeric(raw.replace(/%/g, ""));
    return parsed > 1 ? parsed / 100 : parsed;
  }

  return parseNumeric(raw);
};

const normalizePaymentMethod = (value: unknown) => {
  const method = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (method === "ADVANCE" || method === "ADVANCE_BAL") return "ADVANCE_BALANCE";
  return method || "CASH";
};

const findInventoryItem = async (barcode: string) => {
  if (isDbConnected()) {
    const dbItem = await Inventory.findOne({ barcode }).lean();
    if (dbItem) {
      return dbItem;
    }
  }

  return mockInventory.find((item: any) => String(item?.barcode || "") === barcode);
};

const isFallbackCustomerBlacklisted = (customer: any) => {
  if (!customer) return false;
  const tier = String(customer.customerTier || customer.tags?.[0] || "").toUpperCase();
  const tags = Array.isArray(customer.tags) ? customer.tags.map((t: any) => String(t).toUpperCase()) : [];
  return tier === "BLACKLISTED" || tags.includes("BLACKLISTED");
};

const getCustomerBlacklistReason = async (customerId: string) => {
  if (!customerId || customerId === "walk-in") {
    return null;
  }

  if (isDbConnected()) {
    const customer = await Customer.findOne({
      $or: [
        { _id: customerId },
        { phone: customerId },
        { name: customerId },
      ],
    }).lean();

    if (!customer) {
      return null;
    }

    const tier = String(customer.customerTier || "REGULAR").toUpperCase();
    const tags = Array.isArray(customer.tags) ? customer.tags.map((t: any) => String(t).toUpperCase()) : [];
    if (tier === "BLACKLISTED" || tags.includes("BLACKLISTED")) {
      return customer.blacklistReason || "Blacklisted due to compliance or risk policy";
    }
    return null;
  }

  const customers = await getAllFallbackCustomers();
  const customer = customers.find((cust) => {
    const idMatch = String(cust._id || cust.id || "") === customerId;
    const phoneMatch = String(cust.phone || "") === customerId;
    const nameMatch = String(cust.name || "").toLowerCase() === customerId.toLowerCase();
    return idMatch || phoneMatch || nameMatch;
  });

  if (customer) {
    const tier = String(customer.customerTier || "REGULAR").toUpperCase();
    const tags = Array.isArray(customer.tags) ? customer.tags.map((t: any) => String(t).toUpperCase()) : [];
    if (tier === "BLACKLISTED" || tags.includes("BLACKLISTED")) {
      return customer.blacklistReason || "Blacklisted due to compliance or risk policy";
    }
  }

  return null;
};

const getFallbackPrice = (oldGoldExchange?: OldGoldExchange) => {
  if (!oldGoldExchange) {
    return 0;
  }

  const baseValue = oldGoldExchange.weight * oldGoldExchange.rate;
  return Math.round(baseValue * 1.04);
};

const buildEstimate = async (body: any): Promise<EstimateRecord> => {
  const customerId = typeof body?.customerId === "string" ? body.customerId.trim() : "";
  const items = Array.isArray(body?.items) ? body.items : [];
  const oldGoldExchange = body?.oldGoldExchange
    ? {
        weight: parseNumeric(body.oldGoldExchange.weight),
        purity: String(body.oldGoldExchange.purity ?? ""),
        rate: parseNumeric(body.oldGoldExchange.rate),
      }
    : undefined;

  if (!customerId || items.length === 0) {
    throw new Error("customerId and items are required");
  }

  const subtotal = await items.reduce(async (previousPromise, item) => {
    const runningTotal = await previousPromise;
    const barcode = typeof item?.barcode === "string" ? item.barcode.trim() : "";

    if (!barcode) {
      return runningTotal;
    }

    const savedItem = await findInventoryItem(barcode);

    // Hybrid Making Charge Resolution per item
    let itemMakingCharge = 0;
    if (savedItem) {
      if (savedItem.makingCharges != null && Number(savedItem.makingCharges) > 0) {
        // 1. Inventory Item specific override
        itemMakingCharge = Number(savedItem.makingCharges);
      } else {
        // 2. Rules Engine
        const resolved = await evaluateChargeRulesEngine({
          metalType: savedItem.metal || "GOLD",
          category: savedItem.category || "",
          subCategory: savedItem.subCategory || "",
          purity: savedItem.purity || "",
          weight: Number(savedItem.weight || savedItem.grossWeight || 0),
          quantity: 1,
          productValue: Number(savedItem.price || 0),
          productId: savedItem.sku || savedItem.barcode,
          customerId,
        });
        itemMakingCharge = resolved.chargeAmount;
      }
    }

    if (itemMakingCharge > 0) {
      item.makingCharge = itemMakingCharge;
    }

    if (savedItem?.price) {
      return runningTotal + parseNumeric(savedItem.price) + itemMakingCharge;
    }

    if (savedItem?.weight && savedItem?.rate) {
      return runningTotal + (parseNumeric(savedItem.weight) * parseNumeric(savedItem.rate)) + itemMakingCharge;
    }

    return runningTotal + getFallbackPrice(oldGoldExchange) + itemMakingCharge;
  }, Promise.resolve(0));

  const exchangeDiscount = oldGoldExchange
    ? Math.round(oldGoldExchange.weight * oldGoldExchange.rate * parsePurityFactor(oldGoldExchange.purity))
    : 0;

  // Feature 218 & 220: dynamic charges and tax calculation
  const rulesResult = await evaluateChargeRules({
    subtotal,
    state: body.state || "MH",
    items
  });

  const tax = Math.round(rulesResult.tax);
  const totalCharges = rulesResult.charges.reduce((sum: number, c: any) => sum + c.amount, 0);
  const payable = Math.max(0, subtotal + totalCharges + tax - exchangeDiscount);

  const estimateId = `EST-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const record: EstimateRecord = {
    estimateId,
    customerId,
    items,
    oldGoldExchange,
    result: {
      subtotal,
      tax,
      exchangeDiscount,
      payable,
    },
    createdAt: new Date().toISOString(),
    status: "draft",
  };

  estimateRegistry.set(estimateId, record);
  return record;
};

const getStoredEstimate = (estimateId: string) => estimateRegistry.get(estimateId);

const sumPayments = (payments: Payment[]) => sumFinancialPayments(payments);

const runInvoiceComplianceCheck = async (params: {
  invoiceId: string;
  invoiceTotal: number;
  taxableAmount?: number;
  customerId?: string;
  customerPan?: string;
  customerPhone?: string;
  items?: Array<{ barcode?: string; name?: string }>;
  form60Id?: string;
}) => {
  try {
    return await validateInvoiceCompliance(params);
  } catch (error) {
    if (error instanceof ComplianceValidationError) {
      await logComplianceEvent({
        actionType: "INVOICE_COMPLIANCE_CHECK",
        status: "FAILED",
        entityType: "INVOICE",
        entityId: params.invoiceId,
        message: error.message,
        invoiceTotal: params.invoiceTotal,
        customerPan: params.customerPan,
        details: { code: error.code, ...(error.details || {}) },
      });
    }
    throw error;
  }
};

const applyFinancialEngine = async (
  customerId: string,
  invoiceId: string,
  invoiceTotal: number,
  payments: Payment[],
  allowOutstanding = false
) => {
  if (!isDbConnected() || !customerId || customerId === "walk-in") {
    return null;
  }

  try {
    return await processInvoicePayments({
      customerId,
      invoiceId,
      invoiceTotal,
      payments: normalizePayments(payments),
      allowOutstanding,
    });
  } catch (error) {
    if (error instanceof FinancialValidationError) {
      throw error;
    }
    console.error("Financial engine payment processing failed:", error);
    return null;
  }
};

const buildLedgerEntry = (customerId: string, amount: number, invoiceId: string) => ({
  type: "DEBIT",
  amount,
  note: `POS invoice ${invoiceId}`,
  date: new Date(),
});

const updateLedger = async (customerId: string, amount: number, invoiceId: string) => {
  if (isDbConnected()) {
    const existing = await Khata.findOne({ customerName: customerId });

    if (existing) {
      existing.transactions.push(buildLedgerEntry(customerId, amount, invoiceId));
      existing.balance = Number(existing.balance || 0) + amount;
      await existing.save();
      return existing;
    }

    const created = await Khata.create({
      customerName: customerId,
      customerPhone: "",
      customerAadhar: "",
      balance: amount,
      transactions: [buildLedgerEntry(customerId, amount, invoiceId)],
    });

    return created;
  }

  const existing = mockKhata.find((entry: any) => entry.customerName === customerId);

  if (existing) {
    existing.balance = Number(existing.balance || 0) + amount;
    existing.transactions.push(buildLedgerEntry(customerId, amount, invoiceId));
    return existing;
  }

  const created = {
    _id: `mock_k_${Date.now()}`,
    customerName: customerId,
    customerPhone: "",
    customerAadhar: "",
    balance: amount,
    transactions: [buildLedgerEntry(customerId, amount, invoiceId)],
  };

  mockKhata.push(created);
  return created;
};

const updateCustomerLoyalty = async (customerId: string, payable: number) => {
  if (!isDbConnected()) {
    // Offline fallback referral points check
    try {
      const fallbackUserList = await getAllFallbackCustomers();
      const customer = fallbackUserList.find(c => c._id === customerId || c.name === customerId);
      if (customer) {
        const loyaltyPoints = Math.max(1, Math.floor(payable / 1000));
        customer.loyaltyPoints = Number(customer.loyaltyPoints || 0) + loyaltyPoints;
        customer.totalPurchases = Number(customer.totalPurchases || 0) + payable;
        
        // Feature 141: point allocation
        const settingsDoc = await readSettings();
        const pointsPerReferral = Number(settingsDoc?.settings?.referralPointsAllocation) || 50;
        if (customer.referredBy) {
          const referrer = fallbackUserList.find(c => c._id === customer.referredBy || c.phone === customer.referredBy || c.name === customer.referredBy);
          if (referrer) {
            referrer.loyaltyPoints = Number(referrer.loyaltyPoints || 0) + pointsPerReferral;
            await updateFallbackCustomer(referrer);
          }
        }
        await updateFallbackCustomer(customer);
        return {
          updated: true,
          loyaltyPoints,
          totalPurchases: customer.totalPurchases
        };
      }
    } catch (fallbackErr) {
      console.error("Offline customer loyalty update failed", fallbackErr);
    }
    return {
      updated: false,
      loyaltyPoints: 0,
      totalPurchases: 0,
    };
  }

  const customer = await Customer.findOne({
    $or: [{ _id: customerId }, { name: customerId }],
  });

  if (!customer) {
    return {
      updated: false,
      loyaltyPoints: 0,
      totalPurchases: 0,
    };
  }

  const loyaltyPoints = Math.max(1, Math.floor(payable / 1000));
  customer.loyaltyPoints = Number(customer.loyaltyPoints || 0) + loyaltyPoints;
  customer.totalPurchases = Number(customer.totalPurchases || 0) + payable;
  await customer.save();

  // Feature 141: Referral points-allocation loop
  try {
    const settingsDoc = await readSettings();
    const pointsPerReferral = Number(settingsDoc?.settings?.referralPointsAllocation) || 50;
    
    if (customer.referredBy) {
      const referrer = await Customer.findOne({
        $or: [{ _id: customer.referredBy }, { phone: customer.referredBy }, { name: customer.referredBy }]
      });
      if (referrer) {
        referrer.loyaltyPoints = Number(referrer.loyaltyPoints || 0) + pointsPerReferral;
        await referrer.save();
        console.log(`✓ Allocated ${pointsPerReferral} referral reward points to referrer ${referrer.name}`);
        
        // Also add a transaction note to referrer's khata ledger
        const referrerKhata = await Khata.findOne({ customerName: referrer.name });
        const entry = {
          type: "CREDIT",
          amount: 0, // no money, just points
          note: `Referral reward points (+${pointsPerReferral} pts) for referring ${customer.name}`,
          date: new Date(),
        };
        if (referrerKhata) {
          referrerKhata.transactions.push(entry);
          await referrerKhata.save();
        } else {
          await Khata.create({
            customerName: referrer.name,
            customerPhone: referrer.phone || "",
            balance: 0,
            transactions: [entry]
          });
        }
      }
    }
  } catch (refError) {
    console.error("Referral points allocation loop failed", refError);
  }

  return {
    updated: true,
    loyaltyPoints,
    totalPurchases: customer.totalPurchases,
  };
};

const createSaleRecord = async (
  estimate: EstimateRecord,
  payments: Payment[],
  inventoryUpdates: any[],
  invoiceId: string,
  customerInfo: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAadhar?: string;
    customerPan?: string;
  } = {},
  extras: { tcs?: number } = {}
) => {
  const salePayload = {
    orderId: invoiceId,
    estimateId: estimate.estimateId,
    customerId: estimate.customerId,
    customerName: customerInfo.customerName || estimate.customerId,
    customerPhone: customerInfo.customerPhone || "",
    customerEmail: customerInfo.customerEmail || "",
    customerAadhar: customerInfo.customerAadhar || "",
    customerPan: customerInfo.customerPan || "",
    items: estimate.items.map((item, index) => ({
      barcode: item.barcode,
      name: inventoryUpdates[index]?.name || item.barcode,
      weight: inventoryUpdates[index]?.weight ?? 0,
      purity: inventoryUpdates[index]?.purity ?? "",
      price: inventoryUpdates[index]?.price ?? 0,
      total: inventoryUpdates[index]?.price ?? 0,
      makingCharge: parseNumeric(item.makingCharge),
    })),
    subtotal: estimate.result.subtotal,
    discount: estimate.result.exchangeDiscount,
    tax: estimate.result.tax,
    total: estimate.result.payable,
    exchangeDiscount: estimate.result.exchangeDiscount,
    payable: estimate.result.payable,
    tcs: extras.tcs || 0,
    paymentMethod: payments.map((payment) => payment.method).join(","),
    payments,
    status: "completed",
    createdAt: new Date().toISOString(),
  };

  if (isDbConnected()) {
    const savedSale = await Sale.create(salePayload);
    try {
      const { handlePostSaleReferralReward } = await import("../referrals/referralsController.js");
      await handlePostSaleReferralReward(savedSale);
    } catch (refErr) {
      console.error("Failed to process referral reward:", refErr);
    }
    return savedSale;
  }


  mockSales.push(salePayload);
  return salePayload;
};

const normalizeSaleItem = (item: any) => {
  const price = parseNumeric(item?.price ?? item?.rate);
  const total = parseNumeric(item?.total ?? price);

  return {
    barcode: typeof item?.barcode === "string" ? item.barcode.trim() : "",
    name: String(item?.name ?? item?.barcode ?? "Item"),
    weight: parseNumeric(item?.weight),
    purity: String(item?.purity ?? ""),
    price,
    total,
    makingCharge: parseNumeric(item?.makingCharge),
  };
};

const createDirectSaleRecord = async (
  items: any[],
  invoiceId: string,
  customerInfo: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAadhar?: string;
    customerPan?: string;
    branchCode?: string;
  },
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    tcs?: number;
    total: number;
    paymentMethod: string;
    payments: Payment[];
  }
) => {
  const saleItems = items.map(normalizeSaleItem);

  const salePayload = {
    orderId: invoiceId,
    customerId: customerInfo.customerName || customerInfo.customerEmail || "walk-in",
    customerName: customerInfo.customerName || "Walk-in Customer",
    customerPhone: customerInfo.customerPhone || "",
    customerEmail: customerInfo.customerEmail || "",
    customerAadhar: customerInfo.customerAadhar || "",
    customerPan: customerInfo.customerPan || "",
    items: saleItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    tcs: totals.tcs || 0,
    bisLicence: "CM/L-8700148415",
    total: totals.total,
    exchangeDiscount: totals.discount,
    payable: totals.total,
    paymentMethod: totals.paymentMethod,
    payments: totals.payments,
    status: "completed",
    branchCode: customerInfo.branchCode || "MAIN",
    createdAt: new Date().toISOString(),
  };

  // Flag High-value transactions for Anti-money laundering (AML) compliance auditing
  if (totals.total >= 200000) {
    mockAmlLogs.push({
      logId: `AML-${Date.now()}`,
      customerName: salePayload.customerName,
      customerPhone: salePayload.customerPhone,
      amount: totals.total,
      paymentMethod: salePayload.paymentMethod,
      panNumber: salePayload.customerPan || "NOT PROVIDED",
      flaggedReason: "High-value sale transaction exceeding ₹2 Lakhs limit",
      createdAt: new Date().toISOString()
    });
  }

  if (isDbConnected()) {
    const savedSale = await Sale.create(salePayload);
    try {
      const { handlePostSaleReferralReward } = await import("../referrals/referralsController.js");
      await handlePostSaleReferralReward(savedSale);
    } catch (refErr) {
      console.error("Failed to process referral reward:", refErr);
    }
    return savedSale;
  }


  mockSales.push(salePayload);
  return salePayload;
};

export const estimatePosBilling = async (req: Request, res: Response) => {
  try {
    const estimate = await buildEstimate(req.body);
    return res.json({
      success: true,
      data: {
        estimateId: estimate.estimateId,
        subtotal: estimate.result.subtotal,
        tax: estimate.result.tax,
        exchangeDiscount: estimate.result.exchangeDiscount,
        payable: estimate.result.payable,
      },
    });
  } catch (error: any) {
    console.error("POS estimate error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to estimate billing",
    });
  }
};

export const createPosInvoice = async (req: Request, res: Response) => {
  try {
    const {
      estimateId,
      payments,
      invoiceNumber,
      customerName,
      customerPhone,
      customerEmail,
      customerAadhar,
      items,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      redeemedSchemeId,
    } = req.body as {
      estimateId?: unknown;
      payments?: unknown;
      invoiceNumber?: unknown;
      customerName?: unknown;
      customerPhone?: unknown;
      customerEmail?: unknown;
      customerAadhar?: unknown;
      items?: unknown;
      subtotal?: unknown;
      discount?: unknown;
      tax?: unknown;
      total?: unknown;
      paymentMethod?: unknown;
      redeemedSchemeId?: unknown;
    };

    const useEstimate = typeof estimateId === "string" && estimateId.trim().length > 0;
    const normalizedPayments: Payment[] = Array.isArray(payments)
      ? payments.map((payment: any) => ({
          method: normalizePaymentMethod(payment?.method),
          amount: parseNumeric(payment?.amount),
        }))
      : [];

    if (!useEstimate) {
      const saleItems = Array.isArray(items) ? items : [];
      if (saleItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: "items are required when no estimateId is provided",
        });
      }

      const invoiceId = typeof invoiceNumber === "string" && invoiceNumber.trim().length > 0
        ? invoiceNumber.trim()
        : `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const resolvedPaymentMethod = normalizePaymentMethod(paymentMethod);
      const finalPayments = normalizedPayments.length > 0
        ? normalizedPayments
        : [{ method: resolvedPaymentMethod, amount: parseNumeric(total) }];

      const allowOutstanding = Boolean(req.body.allowOutstanding);

      if (!allowOutstanding && sumPayments(finalPayments) !== parseNumeric(total)) {
        return res.status(400).json({
          success: false,
          error: "Payment amounts must total the invoice amount",
        });
      }

      if (allowOutstanding && sumPayments(finalPayments) > parseNumeric(total)) {
        return res.status(400).json({
          success: false,
          error: "Payment amounts cannot exceed the invoice amount",
        });
      }

      const invoiceTotal = parseNumeric(total);
      const taxableAmount = Math.max(0, parseNumeric(subtotal) - parseNumeric(discount));

      const compliance = await runInvoiceComplianceCheck({
        invoiceId,
        invoiceTotal,
        taxableAmount,
        customerId: typeof req.body.customerId === "string" ? req.body.customerId : undefined,
        customerPan: typeof req.body.customerPan === "string" ? req.body.customerPan : undefined,
        customerPhone: typeof customerPhone === "string" ? customerPhone : undefined,
        items: saleItems.map((item: any) => ({
          barcode: item.barcode,
          name: item.name,
        })),
        form60Id: typeof req.body.form60Id === "string" ? req.body.form60Id : undefined,
      });

      const resolvedTcs =
        parseNumeric(req.body.tcs) > 0 ? parseNumeric(req.body.tcs) : compliance.tcsAmount;

      const sale = await createDirectSaleRecord(saleItems, invoiceId, {
        customerName: typeof customerName === "string" ? customerName.trim() : undefined,
        customerPhone: typeof customerPhone === "string" ? customerPhone.trim() : undefined,
        customerEmail: typeof customerEmail === "string" ? customerEmail.trim() : undefined,
        customerAadhar: typeof customerAadhar === "string" ? customerAadhar.trim() : undefined,
        customerPan: compliance.customerPan || (typeof req.body.customerPan === "string" ? req.body.customerPan.trim() : undefined),
        branchCode: typeof req.body.branchCode === "string" ? req.body.branchCode.trim() : undefined,
      }, {
        subtotal: parseNumeric(subtotal),
        discount: parseNumeric(discount),
        tax: parseNumeric(tax),
        tcs: resolvedTcs,
        total: invoiceTotal,
        paymentMethod: resolvedPaymentMethod,
        payments: finalPayments,
      });

      const resolvedCustomerId =
        typeof req.body.customerId === "string" && req.body.customerId.trim().length > 0
          ? req.body.customerId.trim()
          : typeof customerPhone === "string" && customerPhone.trim().length > 0
          ? customerPhone.trim()
          : typeof customerName === "string" && customerName.trim().length > 0
          ? customerName.trim()
          : "walk-in";

      if (resolvedCustomerId !== "walk-in") {
        const blacklistReason = await getCustomerBlacklistReason(resolvedCustomerId);
        if (blacklistReason) {
          return res.status(403).json({
            success: false,
            error: `Customer is blacklisted and cannot create invoices. Reason: ${blacklistReason}`,
          });
        }
      }

      const financialResult = await applyFinancialEngine(
        resolvedCustomerId,
        invoiceId,
        parseNumeric(total),
        finalPayments,
        allowOutstanding
      );

      const ledger = financialResult
        ? financialResult.ledgerEntry
        : await updateLedger(resolvedCustomerId, parseNumeric(total), invoiceId);

      const loyalty = await updateCustomerLoyalty(resolvedCustomerId, parseNumeric(total));

      if (redeemedSchemeId) {
        await redeemSchemeHelper(String(redeemedSchemeId), invoiceId);
      }

      return res.status(201).json({
        success: true,
        data: {
          invoiceId,
          sale,
          ledger,
          loyalty,
          payments: finalPayments,
          financial: financialResult,
          compliance,
        },
      });
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({
        success: false,
        error: "payments must be a non-empty array",
      });
    }

    const estimate = getStoredEstimate(estimateId as string);

    if (!estimate) {
      return res.status(404).json({
        success: false,
        error: "Estimate not found",
      });
    }

    if (useEstimate) {
      const normalizedEstimatePayments: Payment[] = normalizedPayments;
      const allowOutstanding = Boolean(req.body.allowOutstanding);
      const totalPayment = sumPayments(normalizedEstimatePayments);

      if (!allowOutstanding && totalPayment !== estimate.result.payable) {
        return res.status(400).json({
          success: false,
          error: "Payment split does not match payable amount",
        });
      }

      if (allowOutstanding && totalPayment > estimate.result.payable) {
        return res.status(400).json({
          success: false,
          error: "Payment split cannot exceed payable amount",
        });
      }

      const inventoryUpdates: any[] = [];

      for (const item of estimate.items) {
      const barcode = String(item.barcode || "").trim();

      if (!barcode) {
        return res.status(400).json({
          success: false,
          error: "Each item must include a barcode",
        });
      }

      const savedItem = await findInventoryItem(barcode);

      if (!savedItem) {
        return res.status(404).json({
          success: false,
          error: `Inventory item not found for barcode ${barcode}`,
        });
      }

      if (isDbConnected()) {
        const updatedItem = await Inventory.findOneAndUpdate(
          { barcode },
          { $inc: { stock: -1 }, $set: { status: "sold" } },
          { new: true }
        );

        if (!updatedItem) {
          return res.status(404).json({
            success: false,
            error: `Inventory item not found for barcode ${barcode}`,
          });
        }

        inventoryUpdates.push(updatedItem);
        continue;
      }

      const mockItem = mockInventory.find((entry: any) => String(entry?.barcode || "") === barcode);

      if (!mockItem) {
        return res.status(404).json({
          success: false,
          error: `Inventory item not found for barcode ${barcode}`,
        });
      }

      mockItem.stock = Math.max(0, Number(mockItem.stock || 0) - 1);
      mockItem.status = "sold";
      inventoryUpdates.push(mockItem);
    }

    const prefixedInvoiceNumber = typeof invoiceNumber === "string" && invoiceNumber.trim().length > 0 ? invoiceNumber.trim() : undefined;
    const invoiceId = prefixedInvoiceNumber || `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    if (estimate.customerId) {
      const blacklistReason = await getCustomerBlacklistReason(estimate.customerId);
      if (blacklistReason) {
        return res.status(403).json({
          success: false,
          error: `Customer is blacklisted and cannot create invoices. Reason: ${blacklistReason}`,
        });
      }
    }

    const compliance = await runInvoiceComplianceCheck({
      invoiceId,
      invoiceTotal: estimate.result.payable,
      taxableAmount: estimate.result.subtotal - estimate.result.exchangeDiscount,
      customerId: estimate.customerId,
      customerPan: typeof req.body.customerPan === "string" ? req.body.customerPan : undefined,
      customerPhone: typeof customerPhone === "string" ? customerPhone : undefined,
      items: estimate.items.map((item) => ({ barcode: item.barcode })),
      form60Id: typeof req.body.form60Id === "string" ? req.body.form60Id : undefined,
    });

    const sale = await createSaleRecord(estimate, normalizedPayments, inventoryUpdates, invoiceId, {
      customerName: typeof customerName === "string" ? customerName.trim() : undefined,
      customerPhone: typeof customerPhone === "string" ? customerPhone.trim() : undefined,
      customerEmail: typeof customerEmail === "string" ? customerEmail.trim() : undefined,
      customerAadhar: typeof customerAadhar === "string" ? customerAadhar.trim() : undefined,
      customerPan: compliance.customerPan || (typeof req.body.customerPan === "string" ? req.body.customerPan.trim() : undefined),
    }, { tcs: compliance.tcsAmount });

    const financialResult = await applyFinancialEngine(
      estimate.customerId,
      invoiceId,
      estimate.result.payable,
      normalizedEstimatePayments,
      Boolean(req.body.allowOutstanding)
    );

    const ledger = financialResult
      ? financialResult.ledgerEntry
      : await updateLedger(estimate.customerId, estimate.result.payable, invoiceId);
    const loyalty = await updateCustomerLoyalty(estimate.customerId, estimate.result.payable);

    estimate.status = "completed";

    if (redeemedSchemeId) {
      await redeemSchemeHelper(String(redeemedSchemeId), invoiceId);
    }

    return res.status(201).json({
      success: true,
      data: {
        invoiceId,
        sale,
        ledger,
        inventoryUpdated: inventoryUpdates.map((item) => ({
          barcode: item.barcode || item._id,
          status: item.status || "sold",
          stock: Number(item.stock || 0),
        })),
        loyalty,
        payments: normalizedPayments,
        financial: financialResult,
        compliance,
      },
    });
    }
  } catch (error: any) {
    if (error instanceof ComplianceValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    if (error instanceof FinancialValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("POS invoice error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create POS invoice",
    });
  }
};

export const holdPosInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "invoice id is required",
      });
    }

    const heldRecord = {
      invoiceId: id,
      status: "held",
      heldAt: new Date().toISOString(),
      reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    };

    holdRegistry.set(id, heldRecord);

    return res.json({
      success: true,
      data: heldRecord,
    });
  } catch (error: any) {
    console.error("POS hold error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to place invoice on hold",
    });
  }
};

export const cancelPosInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "invoice id is required",
      });
    }

    const cancelledRecord = {
      invoiceId: id,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    };

    holdRegistry.set(id, cancelledRecord);

    return res.json({
      success: true,
      data: cancelledRecord,
    });
  } catch (error: any) {
    console.error("POS cancel error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to cancel invoice",
    });
  }
};

export const getCheques = async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      const list = await ChequeEmi.find({}).sort({ clearDate: 1 }).lean();
      return res.json({ success: true, data: list });
    } else {
      const list = await getAllFallbackCheques();
      return res.json({ success: true, data: list.sort((a: any, b: any) => String(a.clearDate).localeCompare(String(b.clearDate))) });
    }
  } catch (error: any) {
    console.error("Failed to fetch cheques", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch cheques" });
  }
};

export const createCheque = async (req: Request, res: Response) => {
  try {
    const { chequeNumber, billId, customerName, customerPhone, bank, clearDate, amount, status } = req.body;
    if (!chequeNumber || !billId || !customerName || !bank || !clearDate || !amount) {
      return res.status(400).json({ success: false, error: "Missing required cheque fields" });
    }

    const payload = {
      _id: `CHQ-${Date.now()}`,
      chequeNumber,
      billId,
      customerName,
      customerPhone: customerPhone || "",
      bank,
      clearDate,
      amount: Number(amount),
      status: status || "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      const saved = await ChequeEmi.create(payload);
      return res.status(201).json({ success: true, data: saved });
    } else {
      const saved = await addFallbackCheque(payload);
      return res.status(201).json({ success: true, data: saved });
    }
  } catch (error: any) {
    console.error("Failed to create cheque entry", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create cheque entry" });
  }
};

export const updateChequeStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, bouncedReason } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: "Missing status field" });
    }

    if (isDbConnected()) {
      const updated = await ChequeEmi.findOneAndUpdate(
        { $or: [{ _id: id }, { chequeNumber: id }] },
        { 
          $set: { 
            status, 
            bouncedReason: bouncedReason || "",
            updatedAt: new Date()
          } 
        },
        { new: true }
      );
      if (!updated) return res.status(404).json({ success: false, error: "Cheque not found" });
      return res.json({ success: true, data: updated });
    } else {
      const list = await getAllFallbackCheques();
      const chq = list.find((c: any) => c._id === id || c.chequeNumber === id);
      if (!chq) return res.status(404).json({ success: false, error: "Cheque not found" });
      chq.status = status;
      if (bouncedReason !== undefined) chq.bouncedReason = bouncedReason;
      chq.updatedAt = new Date().toISOString();
      await updateFallbackCheque(chq);
      return res.json({ success: true, data: chq });
    }
  } catch (error: any) {
    console.error("Failed to update cheque status", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to update cheque status" });
  }
};

