import { describe, it, expect, jest } from '@jest/globals';
import { Karikar, Notification } from '../../retailer/models/index.js';
import KarikarAuditLog from '../../models/KarikarAuditLog.js';
import { createKarikarWageLedgerRequest, approveKarikarWageLedger, rejectKarikarWageLedger, payKarikarWageLedger, getKarikarWageLedgerSummary } from '../../karikar/services/karikarWageLedgerService.js';

describe('Karikar wage ledger service', () => {
  it('creates a wage ledger request and updates karikar ledger balance', async () => {
    const karikar = await Karikar.create({
      name: 'Sunita',
      email: 'sunita@example.com',
      password: 'Password123!',
      ledgerBalance: 100,
      status: 'AVAILABLE',
    });

    const payload = {
      periodStart: '2026-07-01',
      periodEnd: '2026-07-07',
      baseWage: 10000,
      overtime: 1500,
      bonus: 500,
      allowances: 200,
      deductions: 1200,
      advances: 1000,
      requestNotes: 'Weekly payout for repair assignments',
    };

    const result = await createKarikarWageLedgerRequest(karikar._id.toString(), payload);
    expect(result.wageLedgerId).toMatch(/^KRW-LEDGER-/);
    expect(result.status).toBe('PENDING');
    expect(result.grossPay).toBe(12200);
    expect(result.netPayable).toBe(10000);
    expect(result.balanceDue).toBe(10000);

    const updatedKarikar = await Karikar.findById(karikar._id);
    expect(updatedKarikar.ledgerBalance).toBe(100 + 10000);
    expect(await Notification.countDocuments({ type: 'KARIKAR_WAGE_LEDGER_REQUEST' })).toBe(1);
  });

  it('approves a pending wage ledger', async () => {
    const karikar = await Karikar.create({
      name: 'Nisha',
      email: 'nisha@example.com',
      password: 'Password123!',
      ledgerBalance: 0,
      status: 'AVAILABLE',
    });

    const ledger = await createKarikarWageLedgerRequest(karikar._id.toString(), {
      periodStart: '2026-07-01',
      periodEnd: '2026-07-07',
      baseWage: 8000,
      overtime: 500,
      deductions: 300,
      advances: 0,
      requestNotes: 'Wage request for finished jobs',
    });

    const approved = await approveKarikarWageLedger(ledger.wageLedgerId, 'approver-1', { adminNotes: 'Verified and approved' });
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('approver-1');
    expect(approved.approvedAt).toBeDefined();
    expect(await KarikarAuditLog.countDocuments({ action: 'karikar-wage-ledger-approved' })).toBeGreaterThanOrEqual(1);
  });

  it('records partial and full payments against a wage ledger', async () => {
    const karikar = await Karikar.create({
      name: 'Rita',
      email: 'rita@example.com',
      password: 'Password123!',
      ledgerBalance: 0,
      status: 'AVAILABLE',
    });

    const ledger = await createKarikarWageLedgerRequest(karikar._id.toString(), {
      periodStart: '2026-07-01',
      periodEnd: '2026-07-07',
      baseWage: 6000,
      bonus: 400,
      deductions: 1000,
      advances: 700,
    });

    const firstPayment = await payKarikarWageLedger(ledger.wageLedgerId, 'payer-1', {
      amount: 3000,
      paymentMethod: 'CASH',
      paymentReference: 'PAY-001',
      note: 'Half payout',
    });
    expect(firstPayment.status).toBe('PARTIAL');
    expect(firstPayment.balanceDue).toBe(4700 - 3000);
    expect(firstPayment.paidAmount).toBe(3000);

    const secondPayment = await payKarikarWageLedger(ledger.wageLedgerId, 'payer-1', {
      amount: 1700,
      paymentMethod: 'CASH',
      paymentReference: 'PAY-002',
      note: 'Remaining payout',
    });
    expect(secondPayment.status).toBe('PAID');
    expect(secondPayment.balanceDue).toBe(0);
    expect(secondPayment.paidAmount).toBe(4700);

    const updatedKarikar = await Karikar.findById(karikar._id);
    expect(updatedKarikar.ledgerBalance).toBe(0);
  });

  it('rejects a pending wage ledger and reverses ledger balance', async () => {
    const karikar = await Karikar.create({
      name: 'Geeta',
      email: 'geeta@example.com',
      password: 'Password123!',
      ledgerBalance: 500,
      status: 'AVAILABLE',
    });

    const ledger = await createKarikarWageLedgerRequest(karikar._id.toString(), {
      periodStart: '2026-07-01',
      periodEnd: '2026-07-07',
      baseWage: 3000,
      overtime: 100,
      deductions: 100,
      advances: 0,
      requestNotes: 'Weekly wage request',
    });

    const rejected = await rejectKarikarWageLedger(ledger.wageLedgerId, 'approver-2', 'Invalid claim');
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Invalid claim');

    const updatedKarikar = await Karikar.findById(karikar._id);
    expect(updatedKarikar.ledgerBalance).toBe(500);
  });

  it('returns wage ledger summary metrics', async () => {
    const karikar = await Karikar.create({
      name: 'Leela',
      email: 'leela@example.com',
      password: 'Password123!',
      ledgerBalance: 0,
      status: 'AVAILABLE',
    });

    await createKarikarWageLedgerRequest(karikar._id.toString(), {
      periodStart: '2026-07-01',
      periodEnd: '2026-07-07',
      baseWage: 7000,
      deductions: 200,
      advances: 0,
    });
    await createKarikarWageLedgerRequest(karikar._id.toString(), {
      periodStart: '2026-07-08',
      periodEnd: '2026-07-14',
      baseWage: 7500,
      deductions: 300,
      advances: 0,
    });

    const summary = await getKarikarWageLedgerSummary(karikar._id.toString());
    expect(summary.totalLedgers).toBeGreaterThanOrEqual(2);
    expect(summary.pendingCount).toBeGreaterThanOrEqual(2);
    expect(summary.totalNet).toBeGreaterThan(0);
  });
});
