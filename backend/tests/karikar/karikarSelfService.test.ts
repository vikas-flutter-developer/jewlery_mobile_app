import { describe, it, expect, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { createKarikarMetalReturn, getKarikarDashboard, getKarikarProfile, listKarikarNotifications, listKarikarSessions, logoutAllKarikarSessions, markKarikarNotificationsRead, updateKarikarProfile, changeKarikarPassword } from '../../karikar/controllers/karikarController.js';
import { getKarikarReturns, getKarikarReturnSummary } from '../../retailer/controllers/dashboards/karikarDashboardController.js';
import { Karikar, Notification, WastageReconciliation } from '../../retailer/models/index.js';
import KarikarAuditLog from '../../models/KarikarAuditLog.js';

describe('Karikar self-service APIs', () => {
  const createRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('returns a lightweight dashboard payload for a karikar', async () => {
    const karikar = await Karikar.create({
      name: 'Asha',
      email: 'asha@example.com',
      password: 'Password123!',
      goldStock: 12.5,
      ledgerBalance: 200,
      jobCards: [{ orderId: 'ORD-1', status: 'OPEN', issuedGrossWeight: 10, issuedAlloy: 1, issuedGoldWeight: 9, dueDate: '2026-07-05', issuedAt: '2026-07-01' }],
      settlements: [{ amount: 500, type: 'CREDIT', createdAt: '2026-07-03' }],
      metalReturns: [{ weight: 2.5, purity: '22K', createdAt: '2026-07-02' }],
      status: 'AVAILABLE',
    });

    const req: any = { user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email } };
    const res = createRes();

    await getKarikarDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        currentJobs: 1,
        pendingMetalReturn: 1,
        unreadNotifications: 0,
        ledgerBalance: 200,
      }),
    }));
  });

  it('allows a karikar to update profile fields and writes an audit log', async () => {
    const karikar = await Karikar.create({
      name: 'Ravi',
      email: 'ravi@example.com',
      password: 'Password123!',
      phone: '9876543210',
      address: 'Old address',
      status: 'AVAILABLE',
    });

    const req: any = {
      user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email },
      body: { phone: '9999999999', address: 'New address', email: 'ravi@aurajewel.com' },
    };
    const res = createRes();

    await updateKarikarProfile(req, res);

    const updated = await Karikar.findById(karikar._id);
    expect(updated.phone).toBe('9999999999');
    expect(updated.address).toBe('New address');
    expect(updated.email).toBe('ravi@aurajewel.com');
    expect(await KarikarAuditLog.countDocuments()).toBeGreaterThan(0);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('changes the password, invalidates sessions and records an audit event', async () => {
    const hashedPassword = await bcrypt.hash('OldPassword123!', 10);
    const karikar = await Karikar.create({
      name: 'Meena',
      email: 'meena@example.com',
      password: hashedPassword,
      sessions: [{ jti: 'session-1', createdAt: new Date(), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60), ip: '127.0.0.1', device: 'test' }],
      status: 'AVAILABLE',
    });

    const req: any = {
      user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email },
      body: { currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' },
    };
    const res = createRes();

    await changeKarikarPassword(req, res);

    const updated = await Karikar.findById(karikar._id);
    expect(updated.password).not.toBe('OldPassword123!');
    expect(updated.sessions).toHaveLength(0);
    expect(await KarikarAuditLog.countDocuments()).toBeGreaterThan(0);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns sessions and supports logout-all', async () => {
    const karikar = await Karikar.create({
      name: 'Nita',
      email: 'nita@example.com',
      password: 'Password123!',
      sessions: [
        { jti: 's1', createdAt: new Date(), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60), ip: '127.0.0.1', device: 'Chrome' },
      ],
      status: 'AVAILABLE',
    });

    const req: any = { user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email } };
    const res = createRes();

    await listKarikarSessions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);

    const logoutRes = createRes();
    await logoutAllKarikarSessions(req, logoutRes);
    const updated = await Karikar.findById(karikar._id);
    expect(updated.sessions).toEqual([]);
    expect(logoutRes.status).toHaveBeenCalledWith(200);
  });

  it('records a karikar metal return and updates gold stock', async () => {
    const karikar = await Karikar.create({
      name: 'Sonal',
      email: 'sonal@example.com',
      password: 'Password123!',
      goldStock: 18.0,
      status: 'AVAILABLE',
    });

    const req: any = {
      user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email },
      body: { weight: 3.5, purity: '22K', note: 'Return after job completion' },
    };
    const res = createRes();

    await createKarikarMetalReturn(req, res);

    const updated = await Karikar.findById(karikar._id).lean();
    expect(updated.goldStock).toBeCloseTo(14.5);
    expect(Array.isArray(updated.metalReturns)).toBe(true);
    expect(updated.metalReturns[0]).toMatchObject({ weight: 3.5, purity: '22K', note: 'Return after job completion', status: 'COMPLETED' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: expect.objectContaining({ weight: 3.5 }) }));
  });

  it('creates a wastage reconciliation request and records a notification', async () => {
    const karikar = await Karikar.create({
      name: 'Priya',
      email: 'priya@example.com',
      password: 'Password123!',
      status: 'AVAILABLE',
    });

    const req: any = {
      user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email },
      body: {
        requestedWeight: 4.2,
        purity: '22K',
        scrapWeight: 0.2,
        estimatedWastage: 0.15,
        notes: 'Wastage for repair job',
      },
    };
    const res = createRes();

    const { createKarikarWastageReconciliation } = await import('../../karikar/controllers/wastageReconciliationController.js');
    await createKarikarWastageReconciliation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        karikarId: karikar._id.toString(),
        status: 'PENDING',
        requestedWeight: 4.2,
      }),
    }));

    expect(await WastageReconciliation.countDocuments()).toBe(1);
    expect(await Notification.countDocuments({ type: 'WASTAGE_RECONCILIATION_REQUEST' })).toBe(1);
  });

  it('approves a wastage reconciliation request and logs approval', async () => {
    const karikar = await Karikar.create({
      name: 'Mira',
      email: 'mira@example.com',
      password: 'Password123!',
      status: 'AVAILABLE',
    });

    const reconciliation = await WastageReconciliation.create({
      reconciliationId: 'TEST-REQ-1',
      karikarId: karikar._id.toString(),
      requestedWeight: 5.0,
      purity: '22K',
      scrapWeight: 0.25,
      estimatedWastage: 0.2,
      status: 'PENDING',
      requestedAt: new Date(),
      updatedAt: new Date(),
    });

    const { approveKarikarWastageReconciliation } = await import('../../karikar/services/wastageReconciliationService.js');
    const approved = await approveKarikarWastageReconciliation(reconciliation.reconciliationId, 'approver-1', {
      actualWastage: 0.18,
      calculatedLoss: 1250,
      notes: 'Approved after quality check',
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('approver-1');
    expect(approved.actualWastage).toBe(0.18);
    expect(approved.calculatedLoss).toBe(1250);
    expect(await WastageReconciliation.countDocuments({ status: 'APPROVED' })).toBe(1);
    expect(await KarikarAuditLog.countDocuments({ action: 'wastage-reconciliation-approved' })).toBe(1);
  });

  it('lists karikar metal returns and returns a summary', async () => {
    const karikar = await Karikar.create({
      name: 'Neha',
      email: 'neha@example.com',
      password: 'Password123!',
      goldStock: 10,
      metalReturns: [
        { returnId: 'R1', weight: 1.5, purity: '22K', status: 'COMPLETED', createdAt: new Date('2026-07-01') },
        { returnId: 'R2', weight: 2.0, purity: '22K', status: 'PENDING', createdAt: new Date('2026-07-02') },
      ],
      status: 'AVAILABLE',
    });

    const listReq: any = { user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email }, params: {}, query: {} };
    const listRes = createRes();
    await getKarikarReturns(listReq, listRes);
    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(listRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ returnId: 'R1', weight: 1.5 }),
        expect.objectContaining({ returnId: 'R2', weight: 2.0 }),
      ]),
    }));

    const summaryReq: any = { user: { id: karikar._id.toString(), role: 'KARIKAR', email: karikar.email }, query: {} };
    const summaryRes = createRes();
    await getKarikarReturnSummary(summaryReq, summaryRes);
    expect(summaryRes.status).toHaveBeenCalledWith(200);
    expect(summaryRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        totalReturns: 2,
        totalReturnedWeight: 3.5,
        pendingCount: 1,
      }),
    }));
  });
});
