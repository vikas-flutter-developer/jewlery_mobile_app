import { ClientSession } from "mongoose";
import {
  FinancialValidationError,
  PaymentSplit,
  generateTransactionId,
  normalizePayments,
  sumPayments,
  validatePayments,
  withMongoTransaction,
} from "./financialEngineService.js";
import { paymentLedgerRepository } from "../../repositories/financial/paymentLedgerRepository.js";
import {
  saleFinancialRepository,
  deriveFinancialStatus,
} from "../../repositories/financial/saleFinancialRepository.js";
import { Customer, Khata } from "../../models/index.js";
import { financeAuditService, AuditContext } from "./financeAuditService.js";
import { emiPlanRepository } from "../../repositories/financial/emiPlanRepository.js";

const normalizePaymentMethod = (value: unknown) => {
  const method = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (method === "ADVANCE" || method === "ADVANCE_BAL") return "ADVANCE_BALANCE";
  return method || "CASH";
};

const findCustomerById = async (customerId: string, session?: ClientSession | null) => {
  const query = Customer.findOne({
    $or: [{ _id: customerId }, { phone: customerId }],
  });
  if (session) query.session(session);
  return query;
};

const appendKhataCredit = async (
  customer: any,
  amount: number,
  note: string,
  session?: ClientSession | null
) => {
  const customerKey = customer.name || String(customer._id);
  const creditEntry = {
    type: "CREDIT" as const,
    amount,
    note,
    date: new Date(),
  };

  const existing = await Khata.findOne({ customerName: customerKey }).session(session || null);
  if (existing) {
    existing.transactions.push(creditEntry);
    existing.balance = Math.max(0, Number(existing.balance || 0) - amount);
    await existing.save({ session: session || undefined });
    return existing;
  }

  return Khata.create(
    [{ customerName: customerKey, customerPhone: customer.phone || "", balance: 0, transactions: [creditEntry] }],
    session ? { session } : undefined
  ).then((docs) => docs[0]);
};

export type RefundPaymentInput = {
  invoiceId: string;
  customerId: string;
  refundAmount: number;
  refundReason: string;
  refundMethod: string;
  note?: string;
  createdBy?: string;
  auditContext?: AuditContext;
};

export type ReversePaymentInput = {
  transactionId: string;
  reason: string;
  createdBy?: string;
  auditContext?: AuditContext;
};

export const processRefund = async (input: RefundPaymentInput) => {
  return withMongoTransaction((session) => executeRefund(session, input));
};

const executeRefund = async (session: ClientSession | null, input: RefundPaymentInput) => {
  const refundAmount = Number(input.refundAmount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new FinancialValidationError("refundAmount must be positive");
  }

  const refundMethod = normalizePaymentMethod(input.refundMethod);
  if (!["CASH", "UPI", "CARD", "ADVANCE_BALANCE"].includes(refundMethod)) {
    throw new FinancialValidationError("Invalid refund method");
  }

  const sale = await saleFinancialRepository.findByOrderId(input.invoiceId, session);
  if (!sale) {
    throw new FinancialValidationError(`Invoice not found: ${input.invoiceId}`);
  }

  const invoiceTotal = Number(sale.payable ?? sale.total ?? 0);
  const amountPaid = Number(sale.amountPaid ?? invoiceTotal);
  if (refundAmount > amountPaid) {
    throw new FinancialValidationError(
      `Refund amount (${refundAmount}) cannot exceed amount paid (${amountPaid})`
    );
  }

  const customer = await findCustomerById(input.customerId, session);
  if (!customer) {
    throw new FinancialValidationError(`Customer not found: ${input.customerId}`);
  }

  const outstandingBefore = Number(customer.outstandingBalance || 0);
  const advanceBalanceBefore = Number(customer.advanceBalance || 0);
  let advanceBalanceAfter = advanceBalanceBefore;
  let outstandingAfter = outstandingBefore;

  if (refundMethod === "ADVANCE_BALANCE") {
    advanceBalanceAfter = advanceBalanceBefore + refundAmount;
    customer.advanceBalance = advanceBalanceAfter;
  } else {
    outstandingAfter = Math.max(0, outstandingBefore - refundAmount);
    customer.outstandingBalance = outstandingAfter;
  }

  await customer.save({ session: session || undefined });

  const newAmountPaid = Math.max(0, amountPaid - refundAmount);
  const newAmountOutstanding = Math.max(0, invoiceTotal - newAmountPaid);
  const financialStatus =
    newAmountPaid <= 0
      ? "REFUNDED"
      : newAmountPaid < invoiceTotal
      ? "PARTIALLY_REFUNDED"
      : deriveFinancialStatus(invoiceTotal, newAmountPaid);

  const previousSale = sale.toObject?.() ?? sale;
  await saleFinancialRepository.updateFinancials(
    input.invoiceId,
    {
      amountPaid: newAmountPaid,
      amountOutstanding: newAmountOutstanding,
      financialStatus,
    },
    session
  );

  const transactionId = generateTransactionId("REF");
  const ledgerEntry = await paymentLedgerRepository.create(
    {
      transactionId,
      invoiceId: input.invoiceId,
      customerId: String(customer._id),
      customerName: customer.name,
      entryType: "REFUND",
      payments: [{ method: refundMethod, amount: refundAmount }],
      totalAmount: refundAmount,
      invoiceTotal,
      outstandingBefore,
      outstandingAfter,
      advanceBalanceBefore,
      advanceBalanceAfter,
      refundReason: input.refundReason,
      note: input.note || `Refund for invoice ${input.invoiceId}`,
      status: "COMPLETED",
      createdBy: input.createdBy,
      relatedEntityType: "SALE",
      relatedEntityId: input.invoiceId,
    },
    session
  );

  await appendKhataCredit(
    customer,
    refundAmount,
    `Refund ${transactionId} for invoice ${input.invoiceId}`,
    session
  );

  await financeAuditService.log(
    {
      actionType: "REFUND",
      entityType: "INVOICE",
      entityId: input.invoiceId,
      previousData: {
        sale: {
          amountPaid: previousSale.amountPaid ?? amountPaid,
          amountOutstanding: previousSale.amountOutstanding,
          financialStatus: previousSale.financialStatus,
        },
        customer: { outstandingBalance: outstandingBefore, advanceBalance: advanceBalanceBefore },
      },
      newData: {
        refundAmount,
        refundMethod,
        refundReason: input.refundReason,
        transactionId,
        sale: { amountPaid: newAmountPaid, amountOutstanding: newAmountOutstanding, financialStatus },
        customer: { outstandingBalance: outstandingAfter, advanceBalance: advanceBalanceAfter },
      },
      context: input.auditContext,
    },
    session
  );

  return {
    transactionId,
    ledgerEntry,
    sale: {
      invoiceId: input.invoiceId,
      amountPaid: newAmountPaid,
      amountOutstanding: newAmountOutstanding,
      financialStatus,
    },
    customer: {
      customerId: String(customer._id),
      outstandingBalance: outstandingAfter,
      advanceBalance: advanceBalanceAfter,
    },
  };
};

export const executeRefundInSession = executeRefund;

export const reversePayment = async (input: ReversePaymentInput) => {
  return withMongoTransaction(async (session) => {
    const original = await paymentLedgerRepository.findByTransactionId(
      input.transactionId,
      session
    );

    if (!original) {
      throw new FinancialValidationError(`Payment transaction not found: ${input.transactionId}`);
    }

    if (original.status === "REVERSED") {
      throw new FinancialValidationError("Payment has already been reversed");
    }

    const customer = await findCustomerById(original.customerId, session);
    if (!customer) {
      throw new FinancialValidationError(`Customer not found: ${original.customerId}`);
    }

    const reversalId = generateTransactionId("REV");
    const outstandingBefore = Number(customer.outstandingBalance || 0);
    const advanceBalanceBefore = Number(customer.advanceBalance || 0);

    customer.outstandingBalance = Number(original.outstandingBefore ?? outstandingBefore);
    customer.advanceBalance = Number(original.advanceBalanceBefore ?? advanceBalanceBefore);
    await customer.save({ session: session || undefined });

    await paymentLedgerRepository.markReversed(original.transactionId, reversalId, session);

    const reversalEntry = await paymentLedgerRepository.create(
      {
        transactionId: reversalId,
        invoiceId: original.invoiceId,
        customerId: original.customerId,
        customerName: original.customerName,
        entryType: "REVERSAL",
        payments: original.payments,
        totalAmount: original.totalAmount,
        invoiceTotal: original.invoiceTotal,
        outstandingBefore,
        outstandingAfter: customer.outstandingBalance,
        advanceBalanceBefore,
        advanceBalanceAfter: customer.advanceBalance,
        reversalOf: original.transactionId,
        refundReason: input.reason,
        note: `Reversal of ${original.transactionId}`,
        status: "COMPLETED",
        createdBy: input.createdBy,
        metadata: { originalEntryType: original.entryType },
      },
      session
    );

    if (original.invoiceId) {
      const sale = await saleFinancialRepository.findByOrderId(original.invoiceId, session);
      if (sale) {
        const invoiceTotal = Number(sale.payable ?? sale.total ?? 0);
        const currentPaid = Math.max(0, Number(sale.amountPaid || 0) - Number(original.totalAmount || 0));
        const amountOutstanding = Math.max(0, invoiceTotal - currentPaid);
        await saleFinancialRepository.updateFinancials(
          original.invoiceId,
          {
            amountPaid: currentPaid,
            amountOutstanding,
            financialStatus: deriveFinancialStatus(invoiceTotal, currentPaid),
          },
          session
        );
      }
    }

    await financeAuditService.log(
      {
        actionType: "REVERSAL",
        entityType: "PAYMENT",
        entityId: original.transactionId,
        previousData: {
          transaction: original.toObject?.() ?? original,
          customer: { outstandingBalance: outstandingBefore, advanceBalance: advanceBalanceBefore },
        },
        newData: {
          reversalTransactionId: reversalId,
          reason: input.reason,
          customer: {
            outstandingBalance: customer.outstandingBalance,
            advanceBalance: customer.advanceBalance,
          },
        },
        context: input.auditContext,
      },
      session
    );

    return {
      reversalTransactionId: reversalId,
      originalTransactionId: original.transactionId,
      reversalEntry,
      customer: {
        customerId: String(customer._id),
        outstandingBalance: customer.outstandingBalance,
        advanceBalance: customer.advanceBalance,
      },
    };
  });
};

export type CollectOutstandingPaymentInput = {
  invoiceId: string;
  customerId: string;
  payments: PaymentSplit[];
  note?: string;
  createdBy?: string;
  auditContext?: AuditContext;
};

export const collectOutstandingPayment = async (input: CollectOutstandingPaymentInput) => {
  return withMongoTransaction(async (session) => {
    const sale = await saleFinancialRepository.findByOrderId(input.invoiceId, session);
    if (!sale) {
      throw new FinancialValidationError(`Invoice not found: ${input.invoiceId}`);
    }

    const invoiceTotal = Number(sale.payable ?? sale.total ?? 0);
    const currentPaid = Number(sale.amountPaid || 0);
    const currentOutstanding = Number(sale.amountOutstanding ?? invoiceTotal - currentPaid);

    if (currentOutstanding <= 0) {
      throw new FinancialValidationError("Invoice has no outstanding balance");
    }

    const normalizedPayments = normalizePayments(input.payments);
    validatePayments(normalizedPayments, currentOutstanding);

    const customer = await findCustomerById(input.customerId, session);
    if (!customer) {
      throw new FinancialValidationError(`Customer not found: ${input.customerId}`);
    }

    const advanceUsed = normalizedPayments
      .filter((p) => normalizePaymentMethod(p.method) === "ADVANCE_BALANCE")
      .reduce((sum, p) => sum + p.amount, 0);

    const outstandingBefore = Number(customer.outstandingBalance || 0);
    const advanceBalanceBefore = Number(customer.advanceBalance || 0);

    if (advanceUsed > advanceBalanceBefore) {
      throw new FinancialValidationError(
        `Insufficient advance balance. Available: ${advanceBalanceBefore}, requested: ${advanceUsed}`
      );
    }

    const totalPaid = sumPayments(normalizedPayments);
    const outstandingAfter = Math.max(0, outstandingBefore - totalPaid);
    const advanceBalanceAfter = advanceBalanceBefore - advanceUsed;

    customer.outstandingBalance = outstandingAfter;
    customer.advanceBalance = advanceBalanceAfter;
    await customer.save({ session: session || undefined });

    const newAmountPaid = currentPaid + totalPaid;
    const newAmountOutstanding = Math.max(0, invoiceTotal - newAmountPaid);
    const financialStatus = deriveFinancialStatus(invoiceTotal, newAmountPaid);

    const previousSale = sale.toObject?.() ?? sale;
    await saleFinancialRepository.updateFinancials(
      input.invoiceId,
      {
        amountPaid: newAmountPaid,
        amountOutstanding: newAmountOutstanding,
        financialStatus,
        payments: [...(sale.payments || []), ...normalizedPayments],
      },
      session
    );

    const transactionId = generateTransactionId("COLL");
    const ledgerEntry = await paymentLedgerRepository.create(
      {
        transactionId,
        invoiceId: input.invoiceId,
        customerId: String(customer._id),
        customerName: customer.name,
        entryType: "INVOICE_PAYMENT",
        payments: normalizedPayments,
        totalAmount: totalPaid,
        invoiceTotal,
        outstandingBefore,
        outstandingAfter,
        advanceBalanceBefore,
        advanceBalanceAfter,
        note: input.note || `Outstanding collection for invoice ${input.invoiceId}`,
        status: "COMPLETED",
        createdBy: input.createdBy,
      },
      session
    );

    const customerKey = customer.name || String(customer._id);
    const existingKhata = await Khata.findOne({ customerName: customerKey }).session(session || null);
    const creditEntry = {
      type: "CREDIT" as const,
      amount: totalPaid,
      note: `Outstanding payment for invoice ${input.invoiceId}`,
      date: new Date(),
    };
    if (existingKhata) {
      existingKhata.transactions.push(creditEntry);
      existingKhata.balance = Math.max(0, Number(existingKhata.balance || 0) - totalPaid);
      await existingKhata.save({ session: session || undefined });
    }

    await financeAuditService.log(
      {
        actionType: "PAYMENT_COLLECTED",
        entityType: "INVOICE",
        entityId: input.invoiceId,
        previousData: {
          amountPaid: currentPaid,
          amountOutstanding: currentOutstanding,
          financialStatus: previousSale.financialStatus,
        },
        newData: {
          amountPaid: newAmountPaid,
          amountOutstanding: newAmountOutstanding,
          financialStatus,
          transactionId,
        },
        context: input.auditContext,
      },
      session
    );

    return {
      transactionId,
      ledgerEntry,
      sale: {
        invoiceId: input.invoiceId,
        amountPaid: newAmountPaid,
        amountOutstanding: newAmountOutstanding,
        financialStatus,
      },
      customer: {
        customerId: String(customer._id),
        outstandingBalance: outstandingAfter,
        advanceBalance: advanceBalanceAfter,
      },
    };
  });
};

export const processPartialInvoicePayment = async (input: {
  customerId: string;
  invoiceId: string;
  invoiceTotal: number;
  payments: PaymentSplit[];
  allowOutstanding: boolean;
  note?: string;
  createdBy?: string;
  auditContext?: AuditContext;
}) => {
  if (!input.allowOutstanding) {
    throw new FinancialValidationError("allowOutstanding must be true for partial payments");
  }

  return withMongoTransaction(async (session) => {
    const normalizedPayments = normalizePayments(input.payments);
    validatePayments(normalizedPayments, input.invoiceTotal, { allowPartial: true });

    const customer = await findCustomerById(input.customerId, session);
    if (!customer) {
      throw new FinancialValidationError(`Customer not found: ${input.customerId}`);
    }

    const advanceUsed = normalizedPayments
      .filter((p) => normalizePaymentMethod(p.method) === "ADVANCE_BALANCE")
      .reduce((sum, p) => sum + p.amount, 0);

    const outstandingBefore = Number(customer.outstandingBalance || 0);
    const advanceBalanceBefore = Number(customer.advanceBalance || 0);

    if (advanceUsed > advanceBalanceBefore) {
      throw new FinancialValidationError(
        `Insufficient advance balance. Available: ${advanceBalanceBefore}, requested: ${advanceUsed}`
      );
    }

    const totalPaid = sumPayments(normalizedPayments);
    const outstandingAfter = Math.max(0, outstandingBefore + input.invoiceTotal - totalPaid);
    const advanceBalanceAfter = advanceBalanceBefore - advanceUsed;

    customer.outstandingBalance = outstandingAfter;
    customer.advanceBalance = advanceBalanceAfter;
    await customer.save({ session: session || undefined });

    const amountOutstanding = Math.max(0, input.invoiceTotal - totalPaid);
    const financialStatus = deriveFinancialStatus(input.invoiceTotal, totalPaid);

    await saleFinancialRepository.updateFinancials(
      input.invoiceId,
      {
        amountPaid: totalPaid,
        amountOutstanding,
        financialStatus,
        allowOutstanding: true,
        payments: normalizedPayments,
      },
      session
    );

    const transactionId = generateTransactionId("PAY");
    const ledgerEntry = await paymentLedgerRepository.create(
      {
        transactionId,
        invoiceId: input.invoiceId,
        customerId: String(customer._id),
        customerName: customer.name,
        entryType: "INVOICE_PAYMENT",
        payments: normalizedPayments,
        totalAmount: totalPaid,
        invoiceTotal: input.invoiceTotal,
        outstandingBefore,
        outstandingAfter,
        advanceBalanceBefore,
        advanceBalanceAfter,
        note: input.note || `Partial payment for invoice ${input.invoiceId}`,
        status: "COMPLETED",
        createdBy: input.createdBy,
      },
      session
    );

    const customerKey = customer.name || String(customer._id);
    const debitEntry = {
      type: "DEBIT" as const,
      amount: input.invoiceTotal,
      note: `POS invoice ${input.invoiceId}`,
      date: new Date(),
    };
    const creditEntry = {
      type: "CREDIT" as const,
      amount: totalPaid,
      note: `Payment received for invoice ${input.invoiceId}`,
      date: new Date(),
    };

    const existingKhata = await Khata.findOne({ customerName: customerKey }).session(session || null);
    if (existingKhata) {
      existingKhata.transactions.push(debitEntry, creditEntry);
      existingKhata.balance = Number(existingKhata.balance || 0) + input.invoiceTotal - totalPaid;
      await existingKhata.save({ session: session || undefined });
    } else {
      await Khata.create(
        [
          {
            customerName: customerKey,
            customerPhone: customer.phone || "",
            balance: input.invoiceTotal - totalPaid,
            transactions: [debitEntry, creditEntry],
          },
        ],
        session ? { session } : undefined
      );
    }

    await financeAuditService.log(
      {
        actionType: "PAYMENT_COLLECTED",
        entityType: "INVOICE",
        entityId: input.invoiceId,
        previousData: null,
        newData: {
          invoiceTotal: input.invoiceTotal,
          amountPaid: totalPaid,
          amountOutstanding,
          financialStatus,
          transactionId,
        },
        context: input.auditContext,
      },
      session
    );

    return {
      transactionId,
      ledgerEntry,
      sale: {
        invoiceId: input.invoiceId,
        amountPaid: totalPaid,
        amountOutstanding,
        financialStatus,
      },
      customer: {
        customerId: String(customer._id),
        outstandingBalance: outstandingAfter,
        advanceBalance: advanceBalanceAfter,
      },
    };
  });
};

export { deriveFinancialStatus };
