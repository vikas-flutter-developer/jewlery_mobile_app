import mongoose from "mongoose";
import { Inventory, Customer, Form60 } from "../../models/index.js";
import { bisCertificateRepository } from "../../repositories/compliance/bisCertificateRepository.js";
import { complianceLogRepository } from "../../repositories/compliance/complianceLogRepository.js";
import { isDbConnected } from "../../../lib/serverState.js";

export const HIGH_VALUE_THRESHOLD = 200_000;
export const TCS_RATE = 0.01;

export class ComplianceValidationError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ComplianceValidationError";
    this.code = code;
    this.details = details;
  }
}

export const generateComplianceLogId = () =>
  `CLG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const generateCertificateId = () =>
  `BIS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const parseNumeric = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const isValidPan = (pan: unknown) => {
  const normalized = String(pan ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(normalized);
};

export const normalizePan = (pan: unknown) =>
  String(pan ?? "")
    .trim()
    .toUpperCase();

export const calculateTcs = (taxableAmount: number, invoiceTotal?: number) => {
  const base = taxableAmount > 0 ? taxableAmount : parseNumeric(invoiceTotal);
  if (base < HIGH_VALUE_THRESHOLD) {
    return { applicable: false, tcsAmount: 0, rate: TCS_RATE, taxableBase: base };
  }
  const tcsAmount = Math.round(base * TCS_RATE * 100) / 100;
  return { applicable: true, tcsAmount, rate: TCS_RATE, taxableBase: base };
};

export type InvoiceComplianceInput = {
  invoiceId: string;
  invoiceTotal: number;
  taxableAmount?: number;
  customerId?: string;
  customerPan?: string;
  customerPhone?: string;
  items?: Array<{ barcode?: string; name?: string }>;
  form60Id?: string;
  userId?: string;
  skipBisCheck?: boolean;
};

const resolveCustomerPan = async (
  customerPan?: string,
  customerId?: string,
  customerPhone?: string
) => {
  if (isValidPan(customerPan)) {
    return normalizePan(customerPan);
  }

  if (!isDbConnected()) {
    return normalizePan(customerPan) || "";
  }

  const customer = customerId
    ? await Customer.findOne({
        $or: [{ _id: customerId }, { phone: customerId }],
      }).lean()
    : customerPhone
    ? await Customer.findOne({ phone: customerPhone }).lean()
    : null;

  if (customer?.pan && isValidPan(customer.pan)) {
    return normalizePan(customer.pan);
  }

  return normalizePan(customerPan) || "";
};

const hasValidForm60 = async (invoiceId: string, customerPhone?: string) => {
  if (!isDbConnected()) return false;

  const form60 = await Form60.findOne({
    $or: [{ transactionId: invoiceId }, ...(customerPhone ? [{ customerPhone }] : [])],
    status: { $in: ["VERIFIED", "PENDING"] },
  }).lean();

  return Boolean(form60);
};

export const validatePanCompliance = async (input: {
  invoiceTotal: number;
  customerPan?: string;
  customerId?: string;
  customerPhone?: string;
  invoiceId?: string;
  form60Id?: string;
}) => {
  const invoiceTotal = parseNumeric(input.invoiceTotal);

  if (invoiceTotal < HIGH_VALUE_THRESHOLD) {
    return { required: false, valid: true, pan: normalizePan(input.customerPan) || null };
  }

  const pan = await resolveCustomerPan(input.customerPan, input.customerId, input.customerPhone);

  if (isValidPan(pan)) {
    return { required: true, valid: true, pan };
  }

  const form60Valid =
    input.form60Id ||
    (input.invoiceId && (await hasValidForm60(input.invoiceId, input.customerPhone)));

  if (form60Valid) {
    return { required: true, valid: true, pan: null, form60Used: true };
  }

  throw new ComplianceValidationError(
    `PAN is mandatory for invoices above ₹${HIGH_VALUE_THRESHOLD.toLocaleString("en-IN")}. Provide a valid PAN or Form 60 declaration.`,
    "PAN_REQUIRED",
    { invoiceTotal, threshold: HIGH_VALUE_THRESHOLD }
  );
};

export const validateBisComplianceForItems = async (
  items: Array<{ barcode?: string; name?: string }>
) => {
  if (!items.length) {
    return { valid: true, items: [] as Array<Record<string, unknown>> };
  }

  await bisCertificateRepository.expirePastDue();

  const results: Array<Record<string, unknown>> = [];
  const failures: string[] = [];

  for (const item of items) {
    const barcode = String(item.barcode ?? "").trim();
    if (!barcode) {
      continue;
    }

    let inventory: any = null;
    if (isDbConnected()) {
      inventory = await Inventory.findOne({
        $or: [{ barcode }, { _id: barcode }, { sku: barcode }],
      }).lean();
    }

    const inventoryId = inventory?._id ? String(inventory._id) : barcode;
    const activeCerts = isDbConnected()
      ? await bisCertificateRepository.findActiveByInventoryId(inventoryId)
      : [];

    const hasActiveCert = activeCerts.length > 0;
    const hasHallmark = Boolean(inventory?.hallmarkCertificate?.trim());
    const hasHuid = Boolean(inventory?.huid && inventory.huid !== "N/A");

    const valid = hasActiveCert || hasHallmark || hasHuid;

    results.push({
      barcode,
      name: item.name || inventory?.name,
      valid,
      hasActiveCert,
      hasHallmark,
      hasHuid,
      certificates: activeCerts,
    });

    if (!valid) {
      failures.push(
        `${item.name || barcode}: missing valid BIS certificate, hallmark, or HUID`
      );
    }
  }

  if (failures.length > 0) {
    throw new ComplianceValidationError(
      `BIS compliance failed for ${failures.length} item(s): ${failures.join("; ")}`,
      "BIS_COMPLIANCE_FAILED",
      { failures, results }
    );
  }

  return { valid: true, items: results };
};

export const logComplianceEvent = async (
  input: Parameters<typeof complianceLogRepository.create>[1]
) => {
  if (!isDbConnected()) {
    return null;
  }
  const logId = generateComplianceLogId();
  return complianceLogRepository.create(logId, input);
};

export const validateInvoiceCompliance = async (input: InvoiceComplianceInput) => {
  const invoiceTotal = parseNumeric(input.invoiceTotal);
  const taxableAmount = parseNumeric(input.taxableAmount ?? invoiceTotal);

  const panResult = await validatePanCompliance({
    invoiceTotal,
    customerPan: input.customerPan,
    customerId: input.customerId,
    customerPhone: input.customerPhone,
    invoiceId: input.invoiceId,
    form60Id: input.form60Id,
  });

  await logComplianceEvent({
    actionType: "PAN_VALIDATION",
    status: panResult.valid ? "PASSED" : "FAILED",
    entityType: "INVOICE",
    entityId: input.invoiceId,
    message: panResult.valid
      ? panResult.pan
        ? `PAN validated for high-value invoice`
        : `Form 60 accepted for high-value invoice`
      : `PAN validation failed`,
    invoiceTotal,
    customerPan: panResult.pan || undefined,
    userId: input.userId,
    details: panResult,
  });

  const tcsResult = calculateTcs(taxableAmount, invoiceTotal);

  if (tcsResult.applicable) {
    await logComplianceEvent({
      actionType: "TCS_CALCULATED",
      status: "PASSED",
      entityType: "INVOICE",
      entityId: input.invoiceId,
      message: `TCS @ ${tcsResult.rate * 100}% calculated: ₹${tcsResult.tcsAmount}`,
      invoiceTotal,
      tcsAmount: tcsResult.tcsAmount,
      userId: input.userId,
      details: tcsResult,
    });
  }

  let bisResult = { valid: true, items: [] as Array<Record<string, unknown>> };
  if (!input.skipBisCheck && input.items?.length) {
    bisResult = await validateBisComplianceForItems(input.items);

    await logComplianceEvent({
      actionType: "BIS_VALIDATION",
      status: "PASSED",
      entityType: "INVOICE",
      entityId: input.invoiceId,
      message: `BIS compliance passed for ${input.items.length} item(s)`,
      invoiceTotal,
      userId: input.userId,
      details: { items: bisResult.items },
    });
  }

  await logComplianceEvent({
    actionType: "INVOICE_COMPLIANCE_CHECK",
    status: "PASSED",
    entityType: "INVOICE",
    entityId: input.invoiceId,
    message: "Invoice compliance check passed",
    invoiceTotal,
    customerPan: panResult.pan || undefined,
    tcsAmount: tcsResult.tcsAmount,
    userId: input.userId,
    details: { panResult, tcsResult, bisResult },
  });

  return {
    passed: true,
    pan: panResult,
    tcs: tcsResult,
    bis: bisResult,
    customerPan: panResult.pan,
    tcsAmount: tcsResult.tcsAmount,
  };
};

export const findInventoryById = async (id: string) => {
  if (!isDbConnected()) {
    return null;
  }

  const query: Record<string, unknown>[] = [{ barcode: id }, { sku: id }];
  if (mongoose.Types.ObjectId.isValid(id)) {
    query.unshift({ _id: id });
  }

  return Inventory.findOne({ $or: query }).lean();
};

export const getComplianceLogs = async (filters: Parameters<typeof complianceLogRepository.findWithFilters>[0]) => {
  if (!isDbConnected()) {
    return { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  }
  return complianceLogRepository.findWithFilters(filters);
};

export const getComplianceLogsByEntity = async (entityId: string, page = 1, limit = 20) => {
  return complianceLogRepository.findByEntityId(entityId, page, limit);
};
