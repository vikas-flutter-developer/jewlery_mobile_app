import mongoose, { ClientSession } from "mongoose";
import {
  Customer,
  Khata,
  PaymentLedger,
  AdvanceDeposit,
  EmiPlan,
} from "../../models/index.js";
import { PAYMENT_METHODS, PaymentMethod } from "../../../models/PaymentLedger.js";
import { financeAuditService, AuditContext } from "./financeAuditService.js";
import {
  saleFinancialRepository,
  deriveFinancialStatus,
} from "../../repositories/financial/saleFinancialRepository.js";
import { isDbConnected } from "../../../lib/serverState.js";

export { PAYMENT_METHODS };
export type { PaymentMethod };

export type PaymentSplit = {
  method: PaymentMethod | string;
  amount: number;
  reference?: string;
};

const parseNumeric = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizePaymentMethod = (value: unknown): PaymentMethod | string => {
  const method = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (method === "ADVANCE" || method === "ADVANCE_BAL") return "ADVANCE_BALANCE";
  return method || "CASH";
};

export const generateTransactionId = (prefix = "TXN") =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const generateDepositId = () => generateTransactionId("ADV");
export const generateEmiPlanId = () => generateTransactionId("EMI");

export const sumPayments = (payments: PaymentSplit[]) =>
  payments.reduce((sum, payment) => sum + parseNumeric(payment.amount), 0);

export const normalizePayments = (payments: unknown[]): PaymentSplit[] => {
  if (!Array.isArray(payments)) return [];
  return payments.map((payment: any) => ({
    method: normalizePaymentMethod(payment?.method),
    amount: parseNumeric(payment?.amount),
    reference: payment?.reference ? String(payment.reference) : undefined,
  }));
};

export class FinancialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialValidationError";
  }
}

export const validatePayments = (
  payments: PaymentSplit[],
  invoiceTotal: number,
  options: { allowPartial?: boolean } = {}
) => {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new FinancialValidationError("payments must be a non-empty array");
  }

  for (const payment of payments) {
    const method = normalizePaymentMethod(payment.method);
    if (!PAYMENT_METHODS.includes(method as PaymentMethod)) {
      throw new FinancialValidationError(
        `Invalid payment method "${payment.method}". Allowed: ${PAYMENT_METHODS.join(", ")}`
      );
    }
    if (parseNumeric(payment.amount) <= 0) {
      throw new FinancialValidationError(`Payment amount must be positive for method ${method}`);
    }
  }

  const totalPaid = sumPayments(payments);
  const expectedTotal = parseNumeric(invoiceTotal);

  if (!options.allowPartial && totalPaid !== expectedTotal) {
    throw new FinancialValidationError(
      `Payment total (${totalPaid}) must equal invoice total (${expectedTotal})`
    );
  }

  if (options.allowPartial && totalPaid > expectedTotal) {
    throw new FinancialValidationError(
      `Payment total (${totalPaid}) cannot exceed invoice total (${expectedTotal})`
    );
  }

  return { totalPaid, expectedTotal };
};

const findCustomerById = async (customerId: string, session?: ClientSession | null) => {
  const query = Customer.findOne({
    $or: [{ _id: customerId }, { phone: customerId }],
  });
  if (session) query.session(session);
  return query;
};

const updateKhataForPayment = async (
  customer: any,
  invoiceId: string,
  invoiceTotal: number,
  totalPaid: number,
  session?: ClientSession | null
) => {
  const customerKey = customer.name || String(customer._id);
  const debitEntry = {
    type: "DEBIT",
    amount: invoiceTotal,
    note: `POS invoice ${invoiceId}`,
    date: new Date(),
  };
  const creditEntry = {
    type: "CREDIT",
    amount: totalPaid,
    note: `Payment received for invoice ${invoiceId}`,
    date: new Date(),
  };

  const existing = await Khata.findOne({ customerName: customerKey }).session(session || null);

  if (existing) {
    existing.transactions.push(debitEntry, creditEntry);
    existing.balance = Number(existing.balance || 0) + invoiceTotal - totalPaid;
    existing.customerPhone = customer.phone || existing.customerPhone;
    await existing.save({ session: session || undefined });
    return existing;
  }

  const balance = invoiceTotal - totalPaid;
  return Khata.create(
    [
      {
        customerName: customerKey,
        customerPhone: customer.phone || "",
        customerAadhar: customer.aadhar || "",
        balance,
        transactions: [debitEntry, creditEntry],
      },
    ],
    session ? { session } : undefined
  ).then((docs) => docs[0]);
};

export async function withMongoTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  if (!isDbConnected()) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export type ProcessInvoicePaymentsInput = {
  customerId: string;
  invoiceId: string;
  invoiceTotal: number;
  payments: PaymentSplit[];
  note?: string;
  createdBy?: string;
  entryType?: "INVOICE_PAYMENT" | "EMI_DOWN_PAYMENT";
  allowOutstanding?: boolean;
  auditContext?: AuditContext;
};

const executeInvoicePayments = async (
  session: ClientSession | null,
  input: ProcessInvoicePaymentsInput
) => {
  const {
    customerId,
    invoiceId,
    invoiceTotal,
    payments,
    note,
    createdBy,
    entryType = "INVOICE_PAYMENT",
    allowOutstanding = false,
    auditContext,
  } = input;
  const normalizedPayments = normalizePayments(payments);
  validatePayments(normalizedPayments, invoiceTotal, { allowPartial: allowOutstanding });

  const customer = await findCustomerById(customerId, session);
  if (!customer) {
    throw new FinancialValidationError(`Customer not found: ${customerId}`);
  }

  const customerTier = String(customer.customerTier || "REGULAR").toUpperCase();
  const customerTags = Array.isArray(customer.tags) ? customer.tags.map((t: any) => String(t).toUpperCase()) : [];
  if (customerTier === "BLACKLISTED" || customerTags.includes("BLACKLISTED")) {
    throw new FinancialValidationError("Customer is blacklisted");
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
  const outstandingAfter = Math.max(0, outstandingBefore + invoiceTotal - totalPaid);
  const advanceBalanceAfter = advanceBalanceBefore - advanceUsed;

  if (allowOutstanding) {
    const creditLimit = Number(customer.creditLimit || 0);
    if (customer.creditBlocked) {
      throw new FinancialValidationError("Customer credit is blocked");
    }
    if (creditLimit > 0 && outstandingAfter > creditLimit) {
      const availableCredit = Math.max(0, creditLimit - outstandingBefore);
      throw new FinancialValidationError(
        `Credit limit exceeded. Available credit: ${availableCredit}, required outstanding: ${Math.max(0, outstandingAfter - outstandingBefore)}`
      );
    }
  }

  customer.outstandingBalance = outstandingAfter;
  customer.advanceBalance = advanceBalanceAfter;
  await customer.save({ session: session || undefined });

  const transactionId = generateTransactionId("PAY");
  const ledgerEntry = await PaymentLedger.create(
    [
      {
        transactionId,
        invoiceId,
        customerId: String(customer._id),
        customerName: customer.name,
        entryType,
        payments: normalizedPayments.map((p) => ({
          method: normalizePaymentMethod(p.method),
          amount: p.amount,
          reference: p.reference,
        })),
        totalAmount: totalPaid,
        invoiceTotal,
        outstandingBefore,
        outstandingAfter,
        advanceBalanceBefore,
        advanceBalanceAfter,
        note: note || `Payment for invoice ${invoiceId}`,
        status: "COMPLETED",
        createdBy,
      },
    ],
    session ? { session } : undefined
  ).then((docs) => docs[0]);

  await updateKhataForPayment(customer, invoiceId, invoiceTotal, totalPaid, session);

  const amountOutstanding = Math.max(0, invoiceTotal - totalPaid);
  const financialStatus = deriveFinancialStatus(invoiceTotal, totalPaid);
  const existingSale = await saleFinancialRepository.findByOrderId(invoiceId, session);
  if (existingSale) {
    await saleFinancialRepository.updateFinancials(
      invoiceId,
      {
        amountPaid: totalPaid,
        amountOutstanding,
        financialStatus,
        allowOutstanding,
        payments: normalizedPayments.map((p) => ({
          method: normalizePaymentMethod(p.method),
          amount: p.amount,
          reference: p.reference,
        })),
      },
      session
    );
  }

  await financeAuditService.log(
    {
      actionType: entryType === "EMI_DOWN_PAYMENT" ? "EMI_CREATED" : "PAYMENT_COLLECTED",
      entityType: "INVOICE",
      entityId: invoiceId,
      previousData: {
        outstandingBalance: outstandingBefore,
        advanceBalance: advanceBalanceBefore,
      },
      newData: {
        transactionId,
        totalPaid,
        amountOutstanding,
        financialStatus,
        outstandingBalance: outstandingAfter,
        advanceBalance: advanceBalanceAfter,
      },
      context: auditContext,
    },
    session
  );

  return {
    transactionId,
    ledgerEntry,
    customer: {
      customerId: String(customer._id),
      name: customer.name,
      outstandingBalance: outstandingAfter,
      advanceBalance: advanceBalanceAfter,
    },
    payments: normalizedPayments,
    totalPaid,
    outstandingBefore,
    outstandingAfter,
    advanceBalanceBefore,
    advanceBalanceAfter,
  };
};

export const processInvoicePayments = async (input: ProcessInvoicePaymentsInput) => {
  return withMongoTransaction((session) => executeInvoicePayments(session, input));
};

const verifyCreditRestrictions = (customer: any, outstandingAfter: number, outstandingBefore: number) => {
  const creditLimit = Number(customer.creditLimit || 0);
  if (customer.creditBlocked) {
    throw new FinancialValidationError("Customer credit is blocked");
  }
  if (creditLimit > 0 && outstandingAfter > creditLimit) {
    const availableCredit = Math.max(0, creditLimit - outstandingBefore);
    throw new FinancialValidationError(
      `Credit limit exceeded. Available credit: ${availableCredit}, required outstanding: ${Math.max(0, outstandingAfter - outstandingBefore)}`
    );
  }
};

export type RecordAdvanceDepositInput = {
  customerId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  note?: string;
  createdBy?: string;
};

export const recordAdvanceDeposit = async (input: RecordAdvanceDepositInput) => {
  const amount = parseNumeric(input.amount);
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);

  if (amount <= 0) {
    throw new FinancialValidationError("Deposit amount must be positive");
  }

  if (!["CASH", "UPI", "CARD"].includes(paymentMethod)) {
    throw new FinancialValidationError("Advance deposits accept CASH, UPI, or CARD only");
  }

  return withMongoTransaction(async (session) => {
    const customer = await findCustomerById(input.customerId, session);
    if (!customer) {
      throw new FinancialValidationError(`Customer not found: ${input.customerId}`);
    }

    const advanceBalanceBefore = Number(customer.advanceBalance || 0);
    const outstandingBefore = Number(customer.outstandingBalance || 0);
    const advanceBalanceAfter = advanceBalanceBefore + amount;

    customer.advanceBalance = advanceBalanceAfter;
    await customer.save({ session: session || undefined });

    const transactionId = generateTransactionId("ADV");
    const depositId = generateDepositId();

    await PaymentLedger.create(
      [
        {
          transactionId,
          customerId: String(customer._id),
          customerName: customer.name,
          entryType: "ADVANCE_DEPOSIT",
          payments: [{ method: paymentMethod, amount, reference: input.reference }],
          totalAmount: amount,
          outstandingBefore,
          outstandingAfter: outstandingBefore,
          advanceBalanceBefore,
          advanceBalanceAfter,
          note: input.note || "Advance deposit",
          status: "COMPLETED",
          createdBy: input.createdBy,
        },
      ],
      session ? { session } : undefined
    );

    const deposit = await AdvanceDeposit.create(
      [
        {
          depositId,
          customerId: String(customer._id),
          customerName: customer.name,
          customerPhone: customer.phone,
          amount,
          paymentMethod,
          reference: input.reference,
          balanceAfter: advanceBalanceAfter,
          note: input.note,
          ledgerTransactionId: transactionId,
        },
      ],
      session ? { session } : undefined
    ).then((docs) => docs[0]);

    const khataKey = customer.name || String(customer._id);
    const creditEntry = {
      type: "CREDIT" as const,
      amount,
      note: `Advance deposit ${depositId}`,
      date: new Date(),
    };

    const existingKhata = await Khata.findOne({ customerName: khataKey }).session(session || null);
    if (existingKhata) {
      existingKhata.transactions.push(creditEntry);
      await existingKhata.save({ session: session || undefined });
    } else {
      await Khata.create(
        [
          {
            customerName: khataKey,
            customerPhone: customer.phone || "",
            balance: 0,
            transactions: [creditEntry],
          },
        ],
        session ? { session } : undefined
      );
    }

    return {
      deposit,
      advanceBalance: advanceBalanceAfter,
      transactionId,
    };
  });
};

export const getAdvanceDepositByCustomer = async (customerId: string) => {
  const customer = await findCustomerById(customerId, null);
  if (!customer) {
    throw new FinancialValidationError(`Customer not found: ${customerId}`);
  }

  const [deposits, transactions] = await Promise.all([
    AdvanceDeposit.find({ customerId: String(customer._id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    PaymentLedger.find({
      customerId: String(customer._id),
      entryType: { $in: ["ADVANCE_DEPOSIT", "ADVANCE_USED", "INVOICE_PAYMENT"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  return {
    customerId: String(customer._id),
    customerName: customer.name,
    customerPhone: customer.phone,
    advanceBalance: Number(customer.advanceBalance || 0),
    outstandingBalance: Number(customer.outstandingBalance || 0),
    deposits,
    paymentHistory: transactions,
  };
};

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addWeeks = (date: Date, weeks: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
};

export type CreateEmiPlanInput = {
  invoiceId: string;
  customerId: string;
  totalAmount: number;
  downPayment: number;
  numberOfInstallments: number;
  frequency?: "MONTHLY" | "WEEKLY";
  downPaymentBreakdown?: PaymentSplit[];
  note?: string;
  createdBy?: string;
};

export const createEmiPlan = async (input: CreateEmiPlanInput) => {
  const totalAmount = parseNumeric(input.totalAmount);
  const downPayment = parseNumeric(input.downPayment);
  const numberOfInstallments = Math.floor(parseNumeric(input.numberOfInstallments));

  if (totalAmount <= 0) {
    throw new FinancialValidationError("totalAmount must be positive");
  }
  if (downPayment < 0 || downPayment >= totalAmount) {
    throw new FinancialValidationError("downPayment must be between 0 and totalAmount");
  }
  if (numberOfInstallments < 1) {
    throw new FinancialValidationError("numberOfInstallments must be at least 1");
  }

  const remainingAmount = totalAmount - downPayment;
  const emiAmount = Math.ceil(remainingAmount / numberOfInstallments);
  const frequency = input.frequency === "WEEKLY" ? "WEEKLY" : "MONTHLY";

  const existingPlan = await EmiPlan.findOne({ invoiceId: input.invoiceId }).lean();
  if (existingPlan) {
    throw new FinancialValidationError(`EMI plan already exists for invoice ${input.invoiceId}`);
  }

  const downPayments = input.downPaymentBreakdown?.length
    ? normalizePayments(input.downPaymentBreakdown)
    : downPayment > 0
    ? [{ method: "CASH" as PaymentMethod, amount: downPayment }]
    : [];

  if (downPayment > 0) {
    validatePayments(downPayments, downPayment);
  }

  return withMongoTransaction(async (session) => {
    const customer = await findCustomerById(input.customerId, session);
    if (!customer) {
      throw new FinancialValidationError(`Customer not found: ${input.customerId}`);
    }

    const outstandingBefore = Number(customer.outstandingBalance || 0);
    let paymentResult = null;
    let advanceBalanceAfter = Number(customer.advanceBalance || 0);

    if (downPayment > 0) {
      paymentResult = await executeInvoicePayments(session, {
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        invoiceTotal: downPayment,
        payments: downPayments,
        note: `EMI down payment for invoice ${input.invoiceId}`,
        createdBy: input.createdBy,
        entryType: "EMI_DOWN_PAYMENT",
      });
      advanceBalanceAfter = paymentResult.advanceBalanceAfter;
    }

    const outstandingAfter = outstandingBefore + remainingAmount;

    const refreshedCustomer = await findCustomerById(input.customerId, session);
    if (refreshedCustomer) {
      refreshedCustomer.outstandingBalance = outstandingAfter;
      await refreshedCustomer.save({ session: session || undefined });
    }

    const now = new Date();
    const installments = Array.from({ length: numberOfInstallments }, (_, index) => {
      const installmentNumber = index + 1;
      const isLast = installmentNumber === numberOfInstallments;
      const amount = isLast
        ? remainingAmount - emiAmount * (numberOfInstallments - 1)
        : emiAmount;
      const dueDate =
        frequency === "WEEKLY"
          ? addWeeks(now, installmentNumber)
          : addMonths(now, installmentNumber);

      return {
        installmentNumber,
        dueDate,
        amount,
        status: "PENDING" as const,
      };
    });

    const emiPlanId = generateEmiPlanId();
    const emiPlan = await EmiPlan.create(
      [
        {
          emiPlanId,
          invoiceId: input.invoiceId,
          customerId: String(customer._id),
          customerName: customer.name,
          totalAmount,
          downPayment,
          emiAmount,
          numberOfInstallments,
          frequency,
          installments,
          remainingAmount,
          status: "ACTIVE",
        },
      ],
      session ? { session } : undefined
    ).then((docs) => docs[0]);

    if (downPayment === 0) {
      const transactionId = generateTransactionId("EMI");
      await PaymentLedger.create(
        [
          {
            transactionId,
            invoiceId: input.invoiceId,
            customerId: String(customer._id),
            customerName: customer.name,
            entryType: "EMI_DOWN_PAYMENT",
            payments: [],
            totalAmount: 0,
            invoiceTotal: totalAmount,
            outstandingBefore,
            outstandingAfter,
            advanceBalanceBefore: Number(customer.advanceBalance || 0),
            advanceBalanceAfter,
            note: input.note || `EMI plan created for invoice ${input.invoiceId}`,
            status: "COMPLETED",
            createdBy: input.createdBy,
          },
        ],
        session ? { session } : undefined
      );
    }

    return {
      emiPlan,
      downPaymentResult: paymentResult,
      outstandingBalance: outstandingAfter,
    };
  });
};

export const getEmiPlanByInvoice = async (invoiceId: string) => {
  const emiPlan = await EmiPlan.findOne({ invoiceId }).lean();
  if (!emiPlan) {
    throw new FinancialValidationError(`EMI plan not found for invoice ${invoiceId}`);
  }

  const paymentHistory = await PaymentLedger.find({
    invoiceId,
    entryType: { $in: ["EMI_DOWN_PAYMENT", "EMI_INSTALLMENT", "INVOICE_PAYMENT"] },
  })
    .sort({ createdAt: -1 })
    .lean();

  const customer = await Customer.findById(emiPlan.customerId).lean();

  return {
    emiPlan,
    paymentHistory,
    customer: customer
      ? {
          customerId: String(customer._id),
          name: customer.name,
          outstandingBalance: Number(customer.outstandingBalance || 0),
          advanceBalance: Number(customer.advanceBalance || 0),
        }
      : null,
  };
};

export const getPaymentTransactionHistory = async (filters: {
  customerId?: string;
  invoiceId?: string;
  limit?: number;
}) => {
  const query: Record<string, unknown> = {};
  if (filters.customerId) query.customerId = filters.customerId;
  if (filters.invoiceId) query.invoiceId = filters.invoiceId;

  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);

  return PaymentLedger.find(query).sort({ createdAt: -1 }).limit(limit).lean();
};
