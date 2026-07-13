import mongoose from "mongoose";
import { Invoice, InvoiceProfile, Sale } from "../../models/index.js";
import { getNextInvoiceNumber, getCurrentFinancialYear } from "./invoiceNumberService.js";
import { generateA4GstPdf, generateThermalPdf, PdfInvoiceDoc, PdfInvoiceItem } from "./pdfService.js";
import { storeBuffer } from "./gridfsService.js";
import { isDbConnected } from "../../../lib/serverState.js";
import {
  validateInvoiceCompliance,
  ComplianceValidationError,
  calculateTcs,
} from "../compliance/complianceEngineService.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateInvoiceOptions {
  /** Existing saleId / orderId from Sale collection */
  saleId: string;
  /** Override specific invoice fields */
  overrides?: Partial<{
    type: "GST" | "ADVANCE" | "PROFORMA";
    customerInfo: Record<string, unknown>;
    items: any[];
    discount: number;
    exchangeDiscount: number;
    tcs: number;
    branchCode: string;
  }>;
  tenantId?: string;
  /** Skip GridFS storage (returns buffer without saving) */
  noStore?: boolean;
}

export interface CreateAdvanceReceiptOptions {
  advanceAmount: number;
  advanceOrderRef?: string;
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    gstin?: string;
    pan?: string;
  };
  paymentMethod?: string;
  paymentReference?: string;
  branchCode?: string;
  tenantId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeGstBreakup(
  items: PdfInvoiceItem[],
  isInterState: boolean
) {
  let taxableValue = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const enriched = items.map((item) => {
    const taxable = item.taxableValue ?? item.price;
    const rate = item.gstRate ?? 3;
    taxableValue += taxable;

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = parseFloat(((taxable * rate) / 100).toFixed(2));
      igstTotal += igst;
    } else {
      cgst = parseFloat(((taxable * rate) / 2 / 100).toFixed(2));
      sgst = cgst;
      cgstTotal += cgst;
      sgstTotal += sgst;
    }

    return {
      ...item,
      taxableValue: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      itemTotal: taxable + cgst + sgst + igst,
    };
  });

  const totalGst = parseFloat((cgstTotal + sgstTotal + igstTotal).toFixed(2));

  return {
    enrichedItems: enriched,
    gstBreakup: {
      cgstRate: isInterState ? 0 : 1.5,
      sgstRate: isInterState ? 0 : 1.5,
      igstRate: isInterState ? 3 : 0,
      cgstAmount: cgstTotal,
      sgstAmount: sgstTotal,
      igstAmount: igstTotal,
      totalGst,
      taxableValue,
    },
  };
}

function saleItemToInvoiceItem(item: any): PdfInvoiceItem {
  const price = Number(item.price ?? item.total ?? 0);
  return {
    name: item.name || item.barcode || "Item",
    hsnCode: item.hsnCode || "7113",
    purity: item.purity || "",
    grossWeight: Number(item.grossWeight ?? item.weight ?? 0),
    netWeight: Number(item.netWeight ?? item.weight ?? 0),
    goldRate: Number(item.goldRate ?? item.rate ?? 0),
    goldAmount: Number(item.goldAmount ?? 0),
    makingCharge: Number(item.makingCharge ?? 0),
    stoneCharge: Number(item.stoneCharge ?? 0),
    bisNumber: item.bisNumber || item.huid || "",
    qty: Number(item.qty ?? 1),
    price,
    taxableValue: Number(item.taxableValue ?? price),
    gstRate: Number(item.gstRate ?? 3),
    cgstAmount: Number(item.cgstAmount ?? 0),
    sgstAmount: Number(item.sgstAmount ?? 0),
    igstAmount: Number(item.igstAmount ?? 0),
    itemTotal: Number(item.itemTotal ?? price),
  };
}

async function getProfile(tenantId?: string): Promise<any> {
  if (isDbConnected()) {
    const profile = await InvoiceProfile.findOne(tenantId ? { tenantId } : {}).lean();
    return profile || {};
  }
  return {};
}

// ─── Core: create invoice from a Sale record ──────────────────────────────────

export async function createInvoiceFromSale(
  opts: CreateInvoiceOptions
): Promise<any> {
  const { saleId, overrides = {}, tenantId = "default-shop", noStore = false } = opts;

  // 1. Fetch the sale
  let sale: any = null;
  if (isDbConnected()) {
    sale = await Sale.findOne({ orderId: saleId }).lean();
  }

  if (!sale) {
    throw new Error(`Sale not found: ${saleId}`);
  }

  const taxableAmount = Math.max(
    0,
    Number(sale.subtotal ?? 0) - Number(sale.discount ?? 0) - Number(sale.exchangeDiscount ?? 0)
  );

  await validateInvoiceCompliance({
    invoiceId: saleId,
    invoiceTotal: Number(sale.payable ?? sale.total ?? 0),
    taxableAmount,
    customerId: sale.customerId,
    customerPan: sale.customerPan,
    customerPhone: sale.customerPhone,
    items: (sale.items || []).map((item: any) => ({
      barcode: item.barcode,
      name: item.name,
    })),
  });

  // 2. Fetch shop profile
  const profile = await getProfile(tenantId);
  const isInterState = profile?.isInterState ?? false;

  // 3. Map sale items → invoice items
  const rawItems: PdfInvoiceItem[] = (overrides.items || sale.items || []).map(
    saleItemToInvoiceItem
  );

  // 4. Compute GST
  const { enrichedItems, gstBreakup } = computeGstBreakup(rawItems, isInterState);

  // 5. Compute totals
  const subtotal = Number(sale.subtotal ?? 0);
  const discount = overrides.discount ?? Number(sale.discount ?? 0);
  const exchangeDiscount = overrides.exchangeDiscount ?? Number(sale.exchangeDiscount ?? 0);
  const taxableAmountForTcs = Math.max(0, subtotal - discount - exchangeDiscount);
  const autoTcs = calculateTcs(taxableAmountForTcs, Number(sale.payable ?? sale.total ?? 0));
  const tcs =
    overrides.tcs ??
    (Number(sale.tcs ?? 0) > 0 ? Number(sale.tcs) : autoTcs.tcsAmount);
  const grandTotal =
    parseFloat((taxableAmountForTcs + gstBreakup.totalGst + tcs).toFixed(2));
  const roundOff = parseFloat((Math.round(grandTotal) - grandTotal).toFixed(2));
  const finalTotal = Math.round(grandTotal);

  // 6. Generate invoice number
  const fy = await getCurrentFinancialYear();
  const invoiceNumber = await getNextInvoiceNumber(tenantId, profile?.prefix || "AJ", fy);

  // 7. Build invoice document
  const invoiceData: any = {
    invoiceNumber,
    saleId,
    type: overrides.type || "GST",
    financialYear: fy,
    tenantId,
    storeProfile: {
      shopName: profile?.shopName,
      address: profile?.address,
      city: profile?.city,
      state: profile?.state,
      pincode: profile?.pincode,
      gstin: profile?.gstin,
      pan: profile?.pan,
      phone: profile?.phone,
      email: profile?.email,
      bisLicence: profile?.bisLicence || sale.bisLicence,
      logo: profile?.logo,
    },
    customerInfo: {
      name: sale.customerName,
      phone: sale.customerPhone,
      email: sale.customerEmail,
      aadhar: sale.customerAadhar,
      pan: sale.customerPan,
      ...(overrides.customerInfo || {}),
    },
    items: enrichedItems,
    subtotal,
    discount,
    exchangeDiscount,
    taxableAmount,
    gstBreakup,
    tcs,
    roundOff,
    grandTotal: finalTotal,
    payments: (sale.payments || []).map((p: any) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
    })),
    branchCode: overrides.branchCode || sale.branchCode || "MAIN",
    status: "final",
  };

  const pdfDoc: PdfInvoiceDoc = {
    ...invoiceData,
    createdAt: sale.createdAt || new Date(),
  };

  // 8. Generate PDFs
  const [a4Buf, th58Buf, th80Buf] = await Promise.all([
    generateA4GstPdf(pdfDoc),
    generateThermalPdf(pdfDoc, 58),
    generateThermalPdf(pdfDoc, 80),
  ]);

  // 9. Store in GridFS (unless noStore)
  if (!noStore && isDbConnected()) {
    const baseName = invoiceNumber.replace(/\//g, "-");
    const [a4Id, th58Id, th80Id] = await Promise.all([
      storeBuffer(a4Buf, `${baseName}-a4.pdf`, "application/pdf"),
      storeBuffer(th58Buf, `${baseName}-thermal58.pdf`, "application/pdf"),
      storeBuffer(th80Buf, `${baseName}-thermal80.pdf`, "application/pdf"),
    ]);
    invoiceData.pdfGridfsId = a4Id;
    invoiceData.thermalPdfGridfsId58 = th58Id;
    invoiceData.thermalPdfGridfsId80 = th80Id;
  }

  // 10. Persist invoice document
  let savedInvoice: any = invoiceData;
  if (isDbConnected()) {
    savedInvoice = await Invoice.create(invoiceData);
  }

  return {
    invoice: savedInvoice,
    buffers: { a4: a4Buf, thermal58: th58Buf, thermal80: th80Buf },
  };
}

// ─── Fetch invoice by ID or invoiceNumber ─────────────────────────────────────

export async function getInvoiceById(id: string): Promise<any> {
  if (!isDbConnected()) return null;

  // Try ObjectId first, then invoiceNumber
  let invoice: any = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    invoice = await Invoice.findById(id).lean();
  }
  if (!invoice) {
    invoice = await Invoice.findOne({ invoiceNumber: id }).lean();
  }
  return invoice;
}

// ─── Re-generate PDFs on-demand (if GridFS ids missing) ───────────────────────

export async function ensureInvoicePdfs(
  invoiceDoc: any
): Promise<{ a4: Buffer; thermal58: Buffer; thermal80: Buffer }> {
  const pdfDoc: PdfInvoiceDoc = {
    invoiceNumber: invoiceDoc.invoiceNumber,
    type: invoiceDoc.type || "GST",
    createdAt: invoiceDoc.createdAt,
    storeProfile: invoiceDoc.storeProfile,
    customerInfo: invoiceDoc.customerInfo,
    items: invoiceDoc.items || [],
    subtotal: invoiceDoc.subtotal || 0,
    discount: invoiceDoc.discount,
    exchangeDiscount: invoiceDoc.exchangeDiscount,
    taxableAmount: invoiceDoc.taxableAmount || 0,
    gstBreakup: invoiceDoc.gstBreakup,
    tcs: invoiceDoc.tcs,
    roundOff: invoiceDoc.roundOff,
    grandTotal: invoiceDoc.grandTotal || 0,
    payments: invoiceDoc.payments,
    advanceAmount: invoiceDoc.advanceAmount,
    advanceOrderRef: invoiceDoc.advanceOrderRef,
  };

  const [a4, thermal58, thermal80] = await Promise.all([
    generateA4GstPdf(pdfDoc),
    generateThermalPdf(pdfDoc, 58),
    generateThermalPdf(pdfDoc, 80),
  ]);

  // Store newly generated PDFs back to GridFS
  if (isDbConnected()) {
    const baseName = invoiceDoc.invoiceNumber.replace(/\//g, "-");
    const updates: Record<string, mongoose.Types.ObjectId> = {};

    if (!invoiceDoc.pdfGridfsId) {
      updates.pdfGridfsId = await storeBuffer(a4, `${baseName}-a4.pdf`, "application/pdf");
    }
    if (!invoiceDoc.thermalPdfGridfsId58) {
      updates.thermalPdfGridfsId58 = await storeBuffer(
        thermal58,
        `${baseName}-thermal58.pdf`,
        "application/pdf"
      );
    }
    if (!invoiceDoc.thermalPdfGridfsId80) {
      updates.thermalPdfGridfsId80 = await storeBuffer(
        thermal80,
        `${baseName}-thermal80.pdf`,
        "application/pdf"
      );
    }

    if (Object.keys(updates).length > 0) {
      await Invoice.findByIdAndUpdate(invoiceDoc._id, { $set: updates });
    }
  }

  return { a4, thermal58, thermal80 };
}

// ─── Advance Receipt ──────────────────────────────────────────────────────────

export async function createAdvanceReceipt(
  opts: CreateAdvanceReceiptOptions
): Promise<any> {
  const {
    advanceAmount,
    advanceOrderRef,
    customerInfo = {},
    paymentMethod = "CASH",
    paymentReference,
    branchCode = "MAIN",
    tenantId = "default-shop",
  } = opts;

  const profile = await getProfile(tenantId);
  const fy = await getCurrentFinancialYear();
  const invoiceNumber = await getNextInvoiceNumber(
    tenantId,
    profile?.prefix || "AJ",
    fy
  );

  const invoiceData: any = {
    invoiceNumber,
    type: "ADVANCE",
    financialYear: fy,
    tenantId,
    storeProfile: {
      shopName: profile?.shopName,
      address: profile?.address,
      city: profile?.city,
      state: profile?.state,
      pincode: profile?.pincode,
      gstin: profile?.gstin,
      pan: profile?.pan,
      phone: profile?.phone,
      email: profile?.email,
      bisLicence: profile?.bisLicence,
    },
    customerInfo: {
      name: customerInfo.name || "Walk-in Customer",
      phone: customerInfo.phone,
      email: customerInfo.email,
      address: customerInfo.address,
      gstin: customerInfo.gstin,
      pan: customerInfo.pan,
    },
    items: [],
    subtotal: 0,
    discount: 0,
    exchangeDiscount: 0,
    taxableAmount: 0,
    gstBreakup: { totalGst: 0, taxableValue: 0 },
    tcs: 0,
    roundOff: 0,
    grandTotal: advanceAmount,
    advanceAmount,
    advanceOrderRef,
    payments: [
      {
        method: paymentMethod,
        amount: advanceAmount,
        reference: paymentReference,
      },
    ],
    branchCode,
    status: "final",
  };

  const pdfDoc: PdfInvoiceDoc = {
    ...invoiceData,
    createdAt: new Date(),
  };

  const [a4Buf, th58Buf, th80Buf] = await Promise.all([
    generateA4GstPdf(pdfDoc),
    generateThermalPdf(pdfDoc, 58),
    generateThermalPdf(pdfDoc, 80),
  ]);

  if (isDbConnected()) {
    const baseName = invoiceNumber.replace(/\//g, "-");
    const [a4Id, th58Id, th80Id] = await Promise.all([
      storeBuffer(a4Buf, `${baseName}-a4.pdf`, "application/pdf"),
      storeBuffer(th58Buf, `${baseName}-thermal58.pdf`, "application/pdf"),
      storeBuffer(th80Buf, `${baseName}-thermal80.pdf`, "application/pdf"),
    ]);
    invoiceData.pdfGridfsId = a4Id;
    invoiceData.thermalPdfGridfsId58 = th58Id;
    invoiceData.thermalPdfGridfsId80 = th80Id;

    const saved = await Invoice.create(invoiceData);
    return { invoice: saved, buffers: { a4: a4Buf, thermal58: th58Buf, thermal80: th80Buf } };
  }

  return { invoice: invoiceData, buffers: { a4: a4Buf, thermal58: th58Buf, thermal80: th80Buf } };
}
