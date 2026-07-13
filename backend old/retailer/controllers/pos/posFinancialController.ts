import { Request, Response } from "express";
import { AuthRequest } from "../../../lib/authUtils.js";
import {
  recordAdvanceDeposit,
  getAdvanceDepositByCustomer,
  createEmiPlan,
  getEmiPlanByInvoice,
  processInvoicePayments,
  getPaymentTransactionHistory,
  FinancialValidationError,
  PAYMENT_METHODS,
} from "../../services/financial/financialEngineService.js";
import { payEmiInstallment, getEmiInstallments } from "../../services/financial/emiPaymentService.js";
import {
  processRefund,
  reversePayment,
  collectOutstandingPayment,
  processPartialInvoicePayment,
} from "../../services/financial/refundReversalService.js";
import { buildAuditContextFromRequest } from "../finance/financeAuditController.js";

const handleFinancialError = (res: Response, error: unknown) => {
  if (error instanceof FinancialValidationError) {
    return res.status(400).json({ success: false, error: error.message });
  }
  console.error("POS financial engine error:", error);
  return res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : "Financial operation failed",
  });
};

const getAuditContext = (req: AuthRequest) => buildAuditContextFromRequest(req);

export const postAdvanceDeposit = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, amount, paymentMethod, reference, note, createdBy } = req.body;

    if (!customerId || amount == null || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: "customerId, amount, and paymentMethod are required",
      });
    }

    const result = await recordAdvanceDeposit({
      customerId: String(customerId),
      amount: Number(amount),
      paymentMethod: String(paymentMethod),
      reference: reference ? String(reference) : undefined,
      note: note ? String(note) : undefined,
      createdBy: createdBy ? String(createdBy) : req.user?.id,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const getAdvanceDeposit = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    if (!customerId) {
      return res.status(400).json({ success: false, error: "customerId is required" });
    }

    const result = await getAdvanceDepositByCustomer(customerId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const postEmiPlan = async (req: AuthRequest, res: Response) => {
  try {
    const {
      invoiceId,
      customerId,
      totalAmount,
      downPayment,
      numberOfInstallments,
      frequency,
      downPaymentBreakdown,
      note,
      createdBy,
    } = req.body;

    if (!invoiceId || !customerId || totalAmount == null || downPayment == null || !numberOfInstallments) {
      return res.status(400).json({
        success: false,
        error: "invoiceId, customerId, totalAmount, downPayment, and numberOfInstallments are required",
      });
    }

    const result = await createEmiPlan({
      invoiceId: String(invoiceId),
      customerId: String(customerId),
      totalAmount: Number(totalAmount),
      downPayment: Number(downPayment),
      numberOfInstallments: Number(numberOfInstallments),
      frequency: frequency === "WEEKLY" ? "WEEKLY" : "MONTHLY",
      downPaymentBreakdown: downPaymentBreakdown,
      note: note ? String(note) : undefined,
      createdBy: createdBy ? String(createdBy) : req.user?.id,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const getEmiByInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: "invoiceId is required" });
    }

    const result = await getEmiPlanByInvoice(invoiceId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const postPayEmiInstallment = async (req: AuthRequest, res: Response) => {
  try {
    const { emiId } = req.params;
    const { installmentNumber, payments, note, createdBy } = req.body;

    if (!emiId || installmentNumber == null || !Array.isArray(payments)) {
      return res.status(400).json({
        success: false,
        error: "emiId, installmentNumber, and payments are required",
      });
    }

    const result = await payEmiInstallment({
      emiPlanId: String(emiId),
      installmentNumber: Number(installmentNumber),
      payments,
      note: note ? String(note) : undefined,
      createdBy: createdBy ? String(createdBy) : req.user?.id,
      auditContext: getAuditContext(req),
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const getEmiInstallmentsList = async (req: Request, res: Response) => {
  try {
    const { emiId } = req.params;
    if (!emiId) {
      return res.status(400).json({ success: false, error: "emiId is required" });
    }

    const result = await getEmiInstallments(emiId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const postProcessPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, invoiceId, invoiceTotal, payments, note, createdBy, allowOutstanding } = req.body;

    if (!customerId || !invoiceId || invoiceTotal == null || !Array.isArray(payments)) {
      return res.status(400).json({
        success: false,
        error: "customerId, invoiceId, invoiceTotal, and payments are required",
      });
    }

    const result = allowOutstanding
      ? await processPartialInvoicePayment({
          customerId: String(customerId),
          invoiceId: String(invoiceId),
          invoiceTotal: Number(invoiceTotal),
          payments,
          allowOutstanding: true,
          note: note ? String(note) : undefined,
          createdBy: createdBy ? String(createdBy) : req.user?.id,
          auditContext: getAuditContext(req),
        })
      : await processInvoicePayments({
          customerId: String(customerId),
          invoiceId: String(invoiceId),
          invoiceTotal: Number(invoiceTotal),
          payments,
          note: note ? String(note) : undefined,
          createdBy: createdBy ? String(createdBy) : req.user?.id,
        });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const postCollectInvoicePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { customerId, payments, note, createdBy } = req.body;

    if (!invoiceId || !customerId || !Array.isArray(payments)) {
      return res.status(400).json({
        success: false,
        error: "invoiceId, customerId, and payments are required",
      });
    }

    const result = await collectOutstandingPayment({
      invoiceId: String(invoiceId),
      customerId: String(customerId),
      payments,
      note: note ? String(note) : undefined,
      createdBy: createdBy ? String(createdBy) : req.user?.id,
      auditContext: getAuditContext(req),
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const postRefundPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId, customerId, refundAmount, refundReason, refundMethod, note, createdBy } = req.body;

    if (!invoiceId || !customerId || refundAmount == null || !refundReason || !refundMethod) {
      return res.status(400).json({
        success: false,
        error: "invoiceId, customerId, refundAmount, refundReason, and refundMethod are required",
      });
    }

    const result = await processRefund({
      invoiceId: String(invoiceId),
      customerId: String(customerId),
      refundAmount: Number(refundAmount),
      refundReason: String(refundReason),
      refundMethod: String(refundMethod),
      note: note ? String(note) : undefined,
      createdBy: createdBy ? String(createdBy) : req.user?.id,
      auditContext: getAuditContext(req),
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const postReversePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { transactionId, reason, createdBy } = req.body;

    if (!transactionId || !reason) {
      return res.status(400).json({
        success: false,
        error: "transactionId and reason are required",
      });
    }

    const result = await reversePayment({
      transactionId: String(transactionId),
      reason: String(reason),
      createdBy: createdBy ? String(createdBy) : req.user?.id,
      auditContext: getAuditContext(req),
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
  try {
    const { customerId, invoiceId, limit } = req.query;

    if (!customerId && !invoiceId) {
      return res.status(400).json({
        success: false,
        error: "customerId or invoiceId query parameter is required",
      });
    }

    const history = await getPaymentTransactionHistory({
      customerId: customerId ? String(customerId) : undefined,
      invoiceId: invoiceId ? String(invoiceId) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json({
      success: true,
      data: {
        transactions: history,
        supportedPaymentMethods: PAYMENT_METHODS,
      },
    });
  } catch (error) {
    return handleFinancialError(res, error);
  }
};
