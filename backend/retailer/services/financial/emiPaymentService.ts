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
import { emiPlanRepository } from "../../repositories/financial/emiPlanRepository.js";
import { paymentLedgerRepository } from "../../repositories/financial/paymentLedgerRepository.js";
import { Customer } from "../../models/index.js";
import { financeAuditService, AuditContext } from "./financeAuditService.js";

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

export type PayEmiInstallmentInput = {
  emiPlanId: string;
  installmentNumber: number;
  payments: PaymentSplit[];
  note?: string;
  createdBy?: string;
  auditContext?: AuditContext;
};

export const getEmiInstallments = async (emiPlanId: string) => {
  const plan = await emiPlanRepository.findByEmiPlanId(emiPlanId);
  if (!plan) {
    throw new FinancialValidationError(`EMI plan not found: ${emiPlanId}`);
  }

  return {
    emiPlanId: plan.emiPlanId,
    invoiceId: plan.invoiceId,
    customerId: plan.customerId,
    status: plan.status,
    remainingAmount: plan.remainingAmount,
    installments: plan.installments,
  };
};

export const payEmiInstallment = async (input: PayEmiInstallmentInput) => {
  const installmentNumber = Math.floor(Number(input.installmentNumber));
  if (!Number.isFinite(installmentNumber) || installmentNumber < 1) {
    throw new FinancialValidationError("installmentNumber must be a positive integer");
  }

  return withMongoTransaction(async (session) => {
    const plan = await emiPlanRepository.findByEmiPlanId(input.emiPlanId, session);
    if (!plan) {
      throw new FinancialValidationError(`EMI plan not found: ${input.emiPlanId}`);
    }

    if (plan.status === "COMPLETED") {
      throw new FinancialValidationError("EMI plan is already fully paid");
    }

    if (plan.status === "CANCELLED") {
      throw new FinancialValidationError("EMI plan is cancelled");
    }

    const installment = plan.installments.find(
      (item: any) => item.installmentNumber === installmentNumber
    );

    if (!installment) {
      throw new FinancialValidationError(`Installment ${installmentNumber} not found`);
    }

    if (installment.status === "PAID") {
      throw new FinancialValidationError(
        `Installment ${installmentNumber} has already been paid`
      );
    }

    const normalizedPayments = normalizePayments(input.payments);
    validatePayments(normalizedPayments, installment.amount);

    const customer = await findCustomerById(plan.customerId, session);
    if (!customer) {
      throw new FinancialValidationError(`Customer not found: ${plan.customerId}`);
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

    const transactionId = generateTransactionId("EMIPAY");
    const previousInstallment = { ...installment.toObject?.() ?? installment };

    installment.status = "PAID";
    installment.paidAt = new Date();
    installment.paymentMethod = normalizedPayments.map((p) => p.method).join(",");
    installment.transactionId = transactionId;

    plan.remainingAmount = Math.max(0, Number(plan.remainingAmount || 0) - totalPaid);

    const allPaid = plan.installments.every((item: any) => item.status === "PAID");
    if (allPaid || plan.remainingAmount <= 0) {
      plan.status = "COMPLETED";
      plan.remainingAmount = 0;
    }

    await emiPlanRepository.save(plan, session);

    const ledgerEntry = await paymentLedgerRepository.create(
      {
        transactionId,
        invoiceId: plan.invoiceId,
        customerId: String(customer._id),
        customerName: customer.name,
        entryType: "EMI_INSTALLMENT",
        payments: normalizedPayments.map((p) => ({
          method: normalizePaymentMethod(p.method),
          amount: p.amount,
          reference: p.reference,
        })),
        totalAmount: totalPaid,
        invoiceTotal: plan.totalAmount,
        outstandingBefore,
        outstandingAfter,
        advanceBalanceBefore,
        advanceBalanceAfter,
        note:
          input.note ||
          `EMI installment ${installmentNumber} for plan ${plan.emiPlanId}`,
        status: "COMPLETED",
        createdBy: input.createdBy,
        relatedEntityType: "EMI_PLAN",
        relatedEntityId: plan.emiPlanId,
        metadata: { installmentNumber },
      },
      session
    );

    await financeAuditService.log(
      {
        actionType: "EMI_PAYMENT",
        entityType: "EMI_PLAN",
        entityId: plan.emiPlanId,
        previousData: {
          installment: previousInstallment,
          remainingAmount: Number(plan.remainingAmount || 0) + totalPaid,
          planStatus: plan.status === "COMPLETED" ? "ACTIVE" : plan.status,
        },
        newData: {
          installment: {
            installmentNumber,
            status: "PAID",
            paidAt: installment.paidAt,
            amount: installment.amount,
            paymentMethod: installment.paymentMethod,
            transactionId,
          },
          remainingAmount: plan.remainingAmount,
          planStatus: plan.status,
          transactionId,
        },
        context: input.auditContext,
      },
      session
    );

    return {
      transactionId,
      ledgerEntry,
      emiPlan: plan.toObject?.() ?? plan,
      installment: {
        installmentNumber,
        dueDate: installment.dueDate,
        paidAt: installment.paidAt,
        amount: installment.amount,
        paymentMethod: installment.paymentMethod,
        reference: normalizedPayments.map((p) => p.reference).filter(Boolean),
        transactionId,
      },
      customer: {
        customerId: String(customer._id),
        outstandingBalance: outstandingAfter,
        advanceBalance: advanceBalanceAfter,
      },
    };
  });
};
