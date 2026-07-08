import {
  FinancialValidationError,
  generateTransactionId,
  withMongoTransaction,
} from "./financialEngineService.js";
import { salesReturnRepository } from "../../repositories/financial/salesReturnRepository.js";
import { saleFinancialRepository } from "../../repositories/financial/saleFinancialRepository.js";
import { emiPlanRepository } from "../../repositories/financial/emiPlanRepository.js";
import { Inventory } from "../../models/index.js";
import { financeAuditService, AuditContext } from "./financeAuditService.js";
import { executeRefundInSession } from "./refundReversalService.js";
import { isDbConnected } from "../../../lib/serverState.js";

export type ProcessSalesReturnInput = {
  orderId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{ itemId?: string; quantity?: number; reason?: string; total?: number }>;
  returnType?: "FULL" | "PARTIAL";
  returnAmount?: number;
  refundMethod?: string;
  refundReason?: string;
  notes?: string;
  auditContext?: AuditContext;
};

const calculateReturnAmount = (sale: any, items: ProcessSalesReturnInput["items"], returnType: string) => {
  if (returnType === "FULL") {
    return Number(sale.payable ?? sale.total ?? 0);
  }

  const itemTotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  if (itemTotal > 0) return itemTotal;

  const saleTotal = Number(sale.payable ?? sale.total ?? 0);
  const ratio = items.length / Math.max(sale.items?.length || 1, 1);
  return Math.round(saleTotal * ratio);
};

export const processSalesReturnFinancial = async (input: ProcessSalesReturnInput) => {
  if (!isDbConnected()) {
    throw new FinancialValidationError("Database connection required for sales return financial processing");
  }

  return withMongoTransaction(async (session) => {
    const sale = await saleFinancialRepository.findByOrderId(input.orderId, session);
    if (!sale) {
      throw new FinancialValidationError(`Sale not found: ${input.orderId}`);
    }

    const returnType = input.returnType || "FULL";
    const returnAmount =
      input.returnAmount != null
        ? Number(input.returnAmount)
        : calculateReturnAmount(sale, input.items, returnType);

    if (returnAmount <= 0) {
      throw new FinancialValidationError("returnAmount must be positive");
    }

    const invoiceTotal = Number(sale.payable ?? sale.total ?? 0);
    if (returnAmount > invoiceTotal) {
      throw new FinancialValidationError("returnAmount cannot exceed invoice total");
    }

    const returnId = generateTransactionId("RET");
    const refundMethod = input.refundMethod || "CASH";
    const previousSale = sale.toObject?.() ?? sale;

    let refundResult = null;
    if (input.customerId) {
      refundResult = await executeRefundInSession(session, {
        invoiceId: input.orderId,
        customerId: input.customerId,
        refundAmount: returnAmount,
        refundReason: input.refundReason || input.notes || "Sales return",
        refundMethod,
        note: `Sales return ${returnId}`,
        auditContext: input.auditContext,
      });
    }

    const emiPlan = await emiPlanRepository.findByInvoiceId(input.orderId, session);
    let emiAdjustment = null;
    if (emiPlan && emiPlan.status === "ACTIVE") {
      const previousRemaining = Number(emiPlan.remainingAmount || 0);
      emiPlan.remainingAmount = Math.max(0, previousRemaining - returnAmount);
      if (emiPlan.remainingAmount <= 0) {
        emiPlan.status = "COMPLETED";
      }
      await emiPlanRepository.save(emiPlan, session);
      emiAdjustment = {
        previousRemaining,
        remainingAmount: emiPlan.remainingAmount,
        status: emiPlan.status,
      };
    }

    for (const item of input.items) {
      if (item.itemId) {
        await Inventory.findOneAndUpdate(
          { barcode: item.itemId },
          { $inc: { stock: item.quantity || 1 }, $set: { status: "In Stock" } },
          { session: session || undefined }
        );
      }
    }

    const salesReturn = await salesReturnRepository.create(
      {
        returnId,
        orderId: input.orderId,
        customerId: input.customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        returnType,
        items: input.items,
        status: "COMPLETED",
        refundStatus: refundResult ? "COMPLETED" : "PENDING",
        returnAmount,
        refundMethod,
        refundTransactionId: refundResult?.transactionId,
        financialProcessed: true,
        notes: input.notes,
      },
      session
    );

    await financeAuditService.log(
      {
        actionType: "SALES_RETURN",
        entityType: "SALES_RETURN",
        entityId: returnId,
        previousData: {
          sale: {
            orderId: input.orderId,
            amountPaid: previousSale.amountPaid,
            financialStatus: previousSale.financialStatus,
          },
          emiRemaining: emiAdjustment?.previousRemaining,
        },
        newData: {
          returnId,
          returnType,
          returnAmount,
          refundTransactionId: refundResult?.transactionId,
          sale: refundResult?.sale,
          emiAdjustment,
        },
        context: input.auditContext,
      },
      session
    );

    return {
      salesReturn,
      refund: refundResult,
      sale: refundResult?.sale,
      emiPlan: emiPlan ? emiPlan.toObject?.() ?? emiPlan : null,
    };
  });
};

export const getSalesReturnsFromDb = async () => {
  return salesReturnRepository.findAll();
};
