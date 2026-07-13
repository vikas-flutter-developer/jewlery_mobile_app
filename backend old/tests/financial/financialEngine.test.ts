import {
  validatePayments,
  sumPayments,
  normalizePayments,
  processInvoicePayments,
  recordAdvanceDeposit,
  createEmiPlan,
  FinancialValidationError,
  withMongoTransaction,
} from "../../retailer/services/financial/financialEngineService.js";
import { payEmiInstallment, getEmiInstallments } from "../../retailer/services/financial/emiPaymentService.js";
import {
  processRefund,
  reversePayment,
  collectOutstandingPayment,
  processPartialInvoicePayment,
} from "../../retailer/services/financial/refundReversalService.js";
import { financeAuditService } from "../../retailer/services/financial/financeAuditService.js";
import { registerRetailerModels } from "../setup.js";

const getRetailerModel = (name: string) => {
  const conn = registerRetailerModels();
  return conn.model(name);
};

const createCustomer = async (overrides: Record<string, unknown> = {}): Promise<any> => {
  const CustomerModel = getRetailerModel("Customer");
  return CustomerModel.create({
    name: "Test Customer",
    phone: `9${Date.now().toString().slice(-9)}`,
    advanceBalance: overrides.advanceBalance ?? 0,
    outstandingBalance: overrides.outstandingBalance ?? 0,
    ...overrides,
  });
};

const createSale = async (customer: any, overrides: Record<string, unknown> = {}): Promise<any> => {
  const SaleModel = getRetailerModel("Sale");
  const orderId = `INV-TEST-${Date.now()}`;
  return SaleModel.create({
    orderId,
    customerId: String(customer._id),
    customerName: customer.name,
    customerPhone: customer.phone,
    items: [{ barcode: "B001", name: "Ring", price: 100000, total: 100000 }],
    subtotal: 100000,
    total: 100000,
    payable: 100000,
    amountPaid: overrides.amountPaid ?? 100000,
    amountOutstanding: overrides.amountOutstanding ?? 0,
    financialStatus: overrides.financialStatus ?? "PAID",
    allowOutstanding: overrides.allowOutstanding ?? false,
    payments: overrides.payments ?? [{ method: "CASH", amount: 100000 }],
    ...overrides,
  });
};

describe("POS Financial Engine", () => {
  beforeEach(() => {
    registerRetailerModels();
  });

  test("1. split payment success", async () => {
    const customer = await createCustomer({ advanceBalance: 20000 });
    const invoiceId = `INV-SPLIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await createSale(customer, { orderId: invoiceId, amountPaid: 0, amountOutstanding: 100000, financialStatus: "UNPAID" });

    const result = await processInvoicePayments({
      customerId: String(customer._id),
      invoiceId,
      invoiceTotal: 100000,
      payments: [
        { method: "CASH", amount: 50000 },
        { method: "UPI", amount: 30000, reference: "UPI1" },
        { method: "ADVANCE_BALANCE", amount: 20000 },
      ],
    });

    expect(result.totalPaid).toBe(100000);
    expect(result.customer.advanceBalance).toBe(0);
  });

  test("2. split payment failure when total mismatch", () => {
    expect(() =>
      validatePayments(
        [
          { method: "CASH", amount: 50000 },
          { method: "UPI", amount: 30000 },
        ],
        100000
      )
    ).toThrow(FinancialValidationError);
  });

  test("3. advance deposit success", async () => {
    const customer = await createCustomer();
    const result = await recordAdvanceDeposit({
      customerId: String(customer._id),
      amount: 15000,
      paymentMethod: "UPI",
      reference: "ADV-UPI-1",
    });

    expect(result.advanceBalance).toBe(15000);
  });

  test("4. advance balance deduction on invoice payment", async () => {
    const customer = await createCustomer({ advanceBalance: 25000 });
    const invoiceId = `INV-ADV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await createSale(customer, { orderId: invoiceId, amountPaid: 0, amountOutstanding: 50000, financialStatus: "UNPAID" });

    const result = await processInvoicePayments({
      customerId: String(customer._id),
      invoiceId,
      invoiceTotal: 50000,
      payments: [
        { method: "CASH", amount: 25000 },
        { method: "ADVANCE_BALANCE", amount: 25000 },
      ],
    });

    expect(result.customer.advanceBalance).toBe(0);
  });

  test("5. insufficient advance balance rejection", async () => {
    const customer = await createCustomer({ advanceBalance: 5000 });

    await expect(
      processInvoicePayments({
        customerId: String(customer._id),
        invoiceId: `INV-FAIL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        invoiceTotal: 20000,
        payments: [{ method: "ADVANCE_BALANCE", amount: 20000 }],
      })
    ).rejects.toThrow(/Insufficient advance balance/);
  });

  test("6. partial payment invoice with allowOutstanding", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-PARTIAL-${Date.now()}`;

    const result = await processPartialInvoicePayment({
      customerId: String(customer._id),
      invoiceId,
      invoiceTotal: 100000,
      allowOutstanding: true,
      payments: [{ method: "CASH", amount: 40000 }],
    });

    expect(result.sale.amountPaid).toBe(40000);
    expect(result.sale.amountOutstanding).toBe(60000);
    expect(result.sale.financialStatus).toBe("PARTIALLY_PAID");
  });

  test("7. outstanding collection against invoice", async () => {
    const customer = await createCustomer();
    const sale = await createSale(customer, {
      amountPaid: 40000,
      amountOutstanding: 60000,
      financialStatus: "PARTIALLY_PAID",
      allowOutstanding: true,
    });

    const result = await collectOutstandingPayment({
      invoiceId: sale.orderId,
      customerId: String(customer._id),
      payments: [{ method: "UPI", amount: 60000, reference: "COLL1" }],
    });

    expect(result.sale.amountPaid).toBe(100000);
    expect(result.sale.financialStatus).toBe("PAID");
  });

  test("8. EMI creation", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-EMI-${Date.now()}`;

    const result = await createEmiPlan({
      invoiceId,
      customerId: String(customer._id),
      totalAmount: 100000,
      downPayment: 20000,
      numberOfInstallments: 4,
      downPaymentBreakdown: [{ method: "CASH", amount: 20000 }],
    });

    expect(result.emiPlan.numberOfInstallments).toBe(4);
    expect(result.emiPlan.remainingAmount).toBe(80000);
  });

  test("9. EMI installment payment", async () => {
    const customer = await createCustomer({ advanceBalance: 10000 });
    const invoiceId = `INV-EMIPAY-${Date.now()}`;

    const planResult = await createEmiPlan({
      invoiceId,
      customerId: String(customer._id),
      totalAmount: 100000,
      downPayment: 20000,
      numberOfInstallments: 4,
      downPaymentBreakdown: [{ method: "CASH", amount: 20000 }],
    });

    const payResult = await payEmiInstallment({
      emiPlanId: planResult.emiPlan.emiPlanId,
      installmentNumber: 1,
      payments: [{ method: "CARD", amount: planResult.emiPlan.installments[0].amount }],
    });

    expect(payResult.installment.paidAt).toBeTruthy();
    expect(payResult.installment.transactionId).toBeTruthy();
  });

  test("10. EMI completion after all installments paid", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-EMIDONE-${Date.now()}`;

    const planResult = await createEmiPlan({
      invoiceId,
      customerId: String(customer._id),
      totalAmount: 60000,
      downPayment: 0,
      numberOfInstallments: 2,
    });

    for (const installment of planResult.emiPlan.installments) {
      await payEmiInstallment({
        emiPlanId: planResult.emiPlan.emiPlanId,
        installmentNumber: installment.installmentNumber,
        payments: [{ method: "CASH", amount: installment.amount }],
      });
    }

    const installments = await getEmiInstallments(planResult.emiPlan.emiPlanId);
    expect(installments.status).toBe("COMPLETED");
  });

  test("11. refund flow", async () => {
    const customer = await createCustomer();
    const sale = await createSale(customer);

    const result = await processRefund({
      invoiceId: sale.orderId,
      customerId: String(customer._id),
      refundAmount: 50000,
      refundReason: "Customer request",
      refundMethod: "CASH",
    });

    expect(result.sale.amountPaid).toBe(50000);
    expect(result.transactionId).toMatch(/^REF-/);
  });

  test("12. payment reversal flow restores balances", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-REV-${Date.now()}`;

    const payment = await processInvoicePayments({
      customerId: String(customer._id),
      invoiceId,
      invoiceTotal: 50000,
      payments: [{ method: "CASH", amount: 50000 }],
    });

    const CustomerModel = getRetailerModel("Customer");
    const beforeReverse = await CustomerModel.findById(customer._id);
    expect(beforeReverse?.outstandingBalance).toBe(0);

    await reversePayment({
      transactionId: payment.transactionId,
      reason: "Incorrect entry",
    });

    const afterReverse = await CustomerModel.findById(customer._id);
    expect(afterReverse?.outstandingBalance).toBe(0);
  });

  test("13. duplicate EMI installment payment is rejected", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-DUP-${Date.now()}`;

    const planResult = await createEmiPlan({
      invoiceId,
      customerId: String(customer._id),
      totalAmount: 50000,
      downPayment: 0,
      numberOfInstallments: 2,
    });

    await payEmiInstallment({
      emiPlanId: planResult.emiPlan.emiPlanId,
      installmentNumber: 1,
      payments: [{ method: "CASH", amount: planResult.emiPlan.installments[0].amount }],
    });

    await expect(
      payEmiInstallment({
        emiPlanId: planResult.emiPlan.emiPlanId,
        installmentNumber: 1,
        payments: [{ method: "CASH", amount: planResult.emiPlan.installments[0].amount }],
      })
    ).rejects.toThrow(/already been paid/);
  });

  test("14. concurrent payment requests - one should fail on duplicate installment", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-CONC-${Date.now()}`;

    const planResult = await createEmiPlan({
      invoiceId,
      customerId: String(customer._id),
      totalAmount: 40000,
      downPayment: 0,
      numberOfInstallments: 2,
    });

    const installment = planResult.emiPlan.installments[0];
    const payInput = {
      emiPlanId: planResult.emiPlan.emiPlanId,
      installmentNumber: installment.installmentNumber,
      payments: [{ method: "CASH", amount: installment.amount }],
    };

    const results = await Promise.allSettled([
      payEmiInstallment(payInput),
      payEmiInstallment(payInput),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  test("15. transaction rollback on validation failure", async () => {
    const customer = await createCustomer({ advanceBalance: 1000 });
    const PaymentLedgerModel = getRetailerModel("PaymentLedger");
    const beforeCount = await PaymentLedgerModel.countDocuments();

    await expect(
      processInvoicePayments({
        customerId: String(customer._id),
        invoiceId: `INV-ROLLBACK-${Date.now()}`,
        invoiceTotal: 50000,
        payments: [{ method: "ADVANCE_BALANCE", amount: 50000 }],
      })
    ).rejects.toThrow(FinancialValidationError);

    const afterCount = await PaymentLedgerModel.countDocuments();
    expect(afterCount).toBe(beforeCount);
  });

  test("16. audit log creation on payment collection", async () => {
    const customer = await createCustomer();
    const invoiceId = `INV-AUDIT-${Date.now()}`;

    await processPartialInvoicePayment({
      customerId: String(customer._id),
      invoiceId,
      invoiceTotal: 100000,
      allowOutstanding: true,
      payments: [{ method: "CASH", amount: 30000 }],
      auditContext: { userId: "user-1", userName: "Cashier", role: "CASHIER" },
    });

    const logs = await financeAuditService.getAuditLogsByEntityId(invoiceId);
    expect(logs.items.length).toBeGreaterThan(0);
    expect(logs.items[0].actionType).toBe("PAYMENT_COLLECTED");
  });

  test("normalizePayments and sumPayments utilities", () => {
    const payments = normalizePayments([
      { method: "advance", amount: 1000 },
      { method: "UPI", amount: 2000, reference: "R1" },
    ]);

    expect(payments[0].method).toBe("ADVANCE_BALANCE");
    expect(sumPayments(payments)).toBe(3000);
  });
});

describe("withMongoTransaction", () => {
  test("commits successful operations", async () => {
    registerRetailerModels();
    const result = await withMongoTransaction(async () => ({ ok: true }));
    expect(result.ok).toBe(true);
  });
});
