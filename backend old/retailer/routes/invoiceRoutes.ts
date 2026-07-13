import express from "express";
import {
  getPdfInvoice,
  getThermalInvoice,
  createAdvanceReceiptHandler,
  listInvoices,
} from "../controllers/invoice/invoiceController.js";

const router = express.Router();

/**
 * GET  /pos/invoices           – list invoices (paginated)
 * GET  /pos/invoices/:id/pdf   – download A4 GST PDF
 * GET  /pos/invoices/:id/thermal?width=58|80  – download thermal PDF
 * POST /pos/receipts/advance   – create advance receipt + PDF
 */
router.get("/invoices", listInvoices);
router.get("/invoices/:id/pdf", getPdfInvoice);
router.get("/invoices/:id/thermal", getThermalInvoice);
router.post("/receipts/advance", createAdvanceReceiptHandler);

export default router;
