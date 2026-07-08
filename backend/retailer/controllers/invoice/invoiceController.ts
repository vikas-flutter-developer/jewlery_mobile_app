import { Request, Response } from "express";
import mongoose from "mongoose";
import { Invoice, InvoiceProfile } from "../../models/index.js";
import {
  createInvoiceFromSale,
  getInvoiceById,
  ensureInvoicePdfs,
  createAdvanceReceipt,
} from "../../services/invoice/invoiceService.js";
import {
  getSeriesConfig,
  updateSeriesConfig,
} from "../../services/invoice/invoiceNumberService.js";
import { streamFile } from "../../services/invoice/gridfsService.js";
import { isDbConnected } from "../../../lib/serverState.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTenantId(req: Request): string {
  return (req as any).tenantId || "default-shop";
}

// ─── GET /pos/invoices/:id/pdf ─────────────────────────────────────────────────

export const getPdfInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Invoice ID is required" });
    }

    // First try to find an existing invoice document
    let invoiceDoc = await getInvoiceById(id);

    // If not found by invoice doc, try treating id as a saleId and creating
    if (!invoiceDoc) {
      // Attempt on-demand creation from Sale
      const tenantId = getTenantId(req);
      try {
        const result = await createInvoiceFromSale({ saleId: id, tenantId });
        invoiceDoc = result.invoice;

        // Stream the freshly generated PDF buffer directly
        const filename = `${invoiceDoc.invoiceNumber?.replace(/\//g, "-") || id}-a4.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(result.buffers.a4);
      } catch (createErr: any) {
        return res.status(404).json({
          success: false,
          error: `Invoice not found and could not be generated: ${createErr.message}`,
        });
      }
    }

    // Invoice found — stream from GridFS if stored, else regenerate
    if (invoiceDoc.pdfGridfsId && isDbConnected()) {
      const filename = `${String(invoiceDoc.invoiceNumber).replace(/\//g, "-")}-a4.pdf`;
      return streamFile(invoiceDoc.pdfGridfsId, res, filename);
    }

    // Regenerate on-demand
    const { a4 } = await ensureInvoicePdfs(invoiceDoc);
    const fname = `${String(invoiceDoc.invoiceNumber).replace(/\//g, "-")}-a4.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    return res.send(a4);
  } catch (err: any) {
    console.error("[InvoiceController] getPdfInvoice error:", err);
    return res.status(500).json({ success: false, error: err.message || "PDF generation failed" });
  }
};

// ─── GET /pos/invoices/:id/thermal ────────────────────────────────────────────

export const getThermalInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const widthParam = req.query.width;
    const width: 58 | 80 =
      widthParam === "58" ? 58 : widthParam === "80" ? 80 : 80;

    if (!id) {
      return res.status(400).json({ success: false, error: "Invoice ID is required" });
    }

    let invoiceDoc = await getInvoiceById(id);

    if (!invoiceDoc) {
      const tenantId = getTenantId(req);
      try {
        const result = await createInvoiceFromSale({ saleId: id, tenantId });
        invoiceDoc = result.invoice;

        const buf = width === 58 ? result.buffers.thermal58 : result.buffers.thermal80;
        const filename = `${invoiceDoc.invoiceNumber?.replace(/\//g, "-") || id}-thermal${width}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(buf);
      } catch (createErr: any) {
        return res.status(404).json({
          success: false,
          error: `Invoice not found: ${createErr.message}`,
        });
      }
    }

    const gridfsId =
      width === 58
        ? invoiceDoc.thermalPdfGridfsId58
        : invoiceDoc.thermalPdfGridfsId80;

    if (gridfsId && isDbConnected()) {
      const filename = `${String(invoiceDoc.invoiceNumber).replace(/\//g, "-")}-thermal${width}.pdf`;
      return streamFile(gridfsId, res, filename);
    }

    // Regenerate
    const buffers = await ensureInvoicePdfs(invoiceDoc);
    const buf = width === 58 ? buffers.thermal58 : buffers.thermal80;
    const fname = `${String(invoiceDoc.invoiceNumber).replace(/\//g, "-")}-thermal${width}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    return res.send(buf);
  } catch (err: any) {
    console.error("[InvoiceController] getThermalInvoice error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Thermal PDF generation failed" });
  }
};

// ─── POST /pos/receipts/advance ───────────────────────────────────────────────

export const createAdvanceReceiptHandler = async (req: Request, res: Response) => {
  try {
    const {
      advanceAmount,
      advanceOrderRef,
      customerInfo,
      paymentMethod,
      paymentReference,
      branchCode,
    } = req.body;

    if (!advanceAmount || Number(advanceAmount) <= 0) {
      return res.status(400).json({ success: false, error: "advanceAmount must be positive" });
    }

    const tenantId = getTenantId(req);

    const result = await createAdvanceReceipt({
      advanceAmount: Number(advanceAmount),
      advanceOrderRef,
      customerInfo,
      paymentMethod,
      paymentReference,
      branchCode,
      tenantId,
    });

    return res.status(201).json({
      success: true,
      data: {
        invoiceId: result.invoice._id,
        invoiceNumber: result.invoice.invoiceNumber,
        advanceAmount,
        pdfAvailable: !!result.invoice.pdfGridfsId,
      },
    });
  } catch (err: any) {
    console.error("[InvoiceController] createAdvanceReceipt error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Failed to create advance receipt" });
  }
};

// ─── GET /settings/invoice-series ─────────────────────────────────────────────

export const getInvoiceSeries = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const config = await getSeriesConfig(tenantId);
    return res.json({ success: true, data: config });
  } catch (err: any) {
    console.error("[InvoiceController] getInvoiceSeries error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PUT /settings/invoice-series ─────────────────────────────────────────────

export const updateInvoiceSeries = async (req: Request, res: Response) => {
  try {
    const { prefix, padLength, resetSequence } = req.body;
    const tenantId = getTenantId(req);

    const updated = await updateSeriesConfig(tenantId, {
      prefix,
      padLength,
      resetSequence: !!resetSequence,
    });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[InvoiceController] updateInvoiceSeries error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /settings/invoice-profile ────────────────────────────────────────────

export const getInvoiceProfileHandler = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!isDbConnected()) {
      return res.json({
        success: true,
        data: { tenantId, shopName: "AuraJewel Store" },
      });
    }

    const profile = await InvoiceProfile.findOne({ tenantId }).lean();
    return res.json({
      success: true,
      data: profile || { tenantId, shopName: "AuraJewel Store" },
    });
  } catch (err: any) {
    console.error("[InvoiceController] getInvoiceProfile error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PUT /settings/invoice-profile ────────────────────────────────────────────

export const updateInvoiceProfileHandler = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const updates = req.body;

    // Remove protected fields from user input
    delete updates._id;
    delete updates.tenantId;
    delete updates.__v;

    if (!isDbConnected()) {
      return res.json({ success: true, data: { tenantId, ...updates } });
    }

    const profile = await InvoiceProfile.findOneAndUpdate(
      { tenantId },
      { $set: { ...updates, tenantId } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: profile });
  } catch (err: any) {
    console.error("[InvoiceController] updateInvoiceProfile error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /pos/invoices (list) ─────────────────────────────────────────────────

export const listInvoices = async (req: Request, res: Response) => {
  try {
    if (!isDbConnected()) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(100, parseInt(String(req.query.limit || "20")));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.saleId) filter.saleId = req.query.saleId;
    if (req.query.status) filter.status = req.query.status;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(filter),
    ]);

    return res.json({ success: true, data: invoices, total, page, limit });
  } catch (err: any) {
    console.error("[InvoiceController] listInvoices error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
