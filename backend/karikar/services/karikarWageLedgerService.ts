import { Karikar, Notification, KarikarWageLedger } from '../../retailer/models/index.js';
import KarikarAuditLog from '../../models/KarikarAuditLog.js';
import { logSecurityEvent } from '../../lib/securityAudit.js';
import { tenantLocalStorage } from '../../lib/db.js';
import { withMongoTransaction } from '../../lib/mongoTransaction.js';

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const getCurrentStoreId = () => tenantLocalStorage.getStore()?.tenantId || 'default-shop';
const generateWageLedgerId = () => `KRW-LEDGER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const parseDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const calculateKarikarWageTotals = (payload: Record<string, unknown>) => {
  const baseWage = Number(payload.baseWage ?? 0);
  const overtime = Number(payload.overtime ?? 0);
  const bonus = Number(payload.bonus ?? 0);
  const allowances = Number(payload.allowances ?? 0);
  const deductions = Number(payload.deductions ?? 0);
  const advances = Number(payload.advances ?? 0);

  const grossPay = Math.max(0, baseWage + overtime + bonus + allowances);
  const netPayable = Math.max(0, grossPay - deductions - advances);
  return { baseWage, overtime, bonus, allowances, deductions, advances, grossPay, netPayable };
};

export const createKarikarWageLedgerRequest = async (karikarId: string, payload: Record<string, unknown>) => {
  const periodStart = parseDate(payload.periodStart) || new Date();
  const periodEnd = parseDate(payload.periodEnd) || new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const periodLabel = normalize(payload.periodLabel) || `${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`;
  const notes = normalize(payload.requestNotes);
  const metadata = typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {};
  const createdBy = normalize(payload.createdBy) || karikarId;

  const totals = calculateKarikarWageTotals(payload);
  if (totals.grossPay <= 0) {
    throw new Error('Gross wage must be greater than 0');
  }

  const storeId = getCurrentStoreId();
  let wageLedger: any;
  let karikarEmail = karikarId;

  await withMongoTransaction(async (session) => {
    const karikar = await Karikar.findById(karikarId).session(session as any);
    if (!karikar) throw new Error('Karikar not found');
    karikarEmail = karikar.email || karikarId;

    wageLedger = new KarikarWageLedger({
      wageLedgerId: generateWageLedgerId(),
      karikarId,
      periodStart,
      periodEnd,
      periodLabel,
      requestNotes: notes,
      createdBy,
      metadata,
      status: 'PENDING',
      ...totals,
      paidAmount: 0,
      balanceDue: totals.netPayable,
      requestedAt: new Date(),
      updatedAt: new Date(),
    });

    await wageLedger.save({ session });
    if (wageLedger.balanceDue > 0) {
      await Karikar.updateOne(
        { _id: karikarId },
        { $inc: { ledgerBalance: wageLedger.balanceDue }, $set: { updatedAt: new Date() } },
        { session }
      );
    }

    await Notification.create([
      {
        notificationId: `KARIKAR_WAGE_REQUEST_${wageLedger.wageLedgerId}`,
        tenantId: storeId,
        storeId,
        type: 'KARIKAR_WAGE_LEDGER_REQUEST',
        title: 'Karikar wage request created',
        message: `Wage ledger request ${wageLedger.wageLedgerId} created for ${periodLabel}.`,
        category: 'Wages',
        severity: 'INFO',
        channels: ['IN_APP'],
        reference: wageLedger.wageLedgerId,
        relatedEntityId: karikarId,
        sendAt: new Date(),
        status: 'PENDING',
      },
    ], { session });
  });

  await KarikarAuditLog.create({
    karikarId,
    action: 'karikar-wage-ledger-request',
    details: 'Karikar wage ledger request created',
    metadata: {
      wageLedgerId: wageLedger.wageLedgerId,
      periodLabel,
      netPayable: wageLedger.netPayable,
    },
  });

  await logSecurityEvent(karikarEmail, 'karikar-wage-request', karikarId, `Karikar wage request created: ${wageLedger.wageLedgerId}`);
  return wageLedger.toObject();
};

export const listKarikarWageLedgers = async (karikarId: string) => {
  return KarikarWageLedger.find({ karikarId }).sort({ requestedAt: -1 }).lean();
};

export const getKarikarWageLedger = async (karikarId: string, wageLedgerId: string) => {
  return KarikarWageLedger.findOne({ karikarId, wageLedgerId }).lean();
};

export const getKarikarWageLedgerSummary = async (karikarId: string) => {
  const records = await listKarikarWageLedgers(karikarId);
  const totalLedgers = records.length;
  const pendingCount = records.filter((r: any) => r.status === 'PENDING').length;
  const approvedCount = records.filter((r: any) => r.status === 'APPROVED').length;
  const paidCount = records.filter((r: any) => r.status === 'PAID').length;
  const partialCount = records.filter((r: any) => r.status === 'PARTIAL').length;
  const rejectedCount = records.filter((r: any) => r.status === 'REJECTED').length;
  const totalGross = records.reduce((sum: number, r: any) => sum + Number(r.grossPay || 0), 0);
  const totalNet = records.reduce((sum: number, r: any) => sum + Number(r.netPayable || 0), 0);
  const totalPaid = records.reduce((sum: number, r: any) => sum + Number(r.paidAmount || 0), 0);
  const totalDue = records.reduce((sum: number, r: any) => sum + Number(r.balanceDue || 0), 0);

  return {
    totalLedgers,
    pendingCount,
    approvedCount,
    paidCount,
    partialCount,
    rejectedCount,
    totalGross,
    totalNet,
    totalPaid,
    totalDue,
    averageNetPayable: totalLedgers ? Number((totalNet / totalLedgers).toFixed(2)) : 0,
  };
};

export const listAllKarikarWageLedgers = async (filters: { karikarId?: string; status?: string; fromDate?: Date | null; toDate?: Date | null } = {}) => {
  const query: Record<string, unknown> = {};
  if (filters.karikarId) query.karikarId = filters.karikarId;
  if (filters.status) query.status = filters.status.toUpperCase();
  if (filters.fromDate || filters.toDate) {
    query.requestedAt = {} as Record<string, Date>;
    if (filters.fromDate) (query.requestedAt as any).$gte = filters.fromDate;
    if (filters.toDate) (query.requestedAt as any).$lte = filters.toDate;
  }
  return KarikarWageLedger.find(query).sort({ requestedAt: -1 }).lean();
};

export const getAllKarikarWageLedgerSummary = async (filters: { karikarId?: string; status?: string; fromDate?: Date | null; toDate?: Date | null } = {}) => {
  const records = await listAllKarikarWageLedgers(filters);
  const totalLedgers = records.length;
  const pendingCount = records.filter((r: any) => r.status === 'PENDING').length;
  const approvedCount = records.filter((r: any) => r.status === 'APPROVED').length;
  const paidCount = records.filter((r: any) => r.status === 'PAID').length;
  const partialCount = records.filter((r: any) => r.status === 'PARTIAL').length;
  const rejectedCount = records.filter((r: any) => r.status === 'REJECTED').length;
  const totalGross = records.reduce((sum: number, r: any) => sum + Number(r.grossPay || 0), 0);
  const totalNet = records.reduce((sum: number, r: any) => sum + Number(r.netPayable || 0), 0);
  const totalPaid = records.reduce((sum: number, r: any) => sum + Number(r.paidAmount || 0), 0);
  const totalDue = records.reduce((sum: number, r: any) => sum + Number(r.balanceDue || 0), 0);

  const topKarikars = records.reduce((map: Record<string, any>, record: any) => {
    const key = record.karikarId;
    if (!map[key]) {
      map[key] = { karikarId: key, totalNet: 0, ledgerCount: 0, totalPaid: 0, totalDue: 0 };
    }
    map[key].ledgerCount += 1;
    map[key].totalNet += Number(record.netPayable || 0);
    map[key].totalPaid += Number(record.paidAmount || 0);
    map[key].totalDue += Number(record.balanceDue || 0);
    return map;
  }, {} as Record<string, any>);

  const topKarikarList = Object.values(topKarikars)
    .sort((a: any, b: any) => b.totalNet - a.totalNet)
    .slice(0, 10);

  return {
    totalLedgers,
    pendingCount,
    approvedCount,
    paidCount,
    partialCount,
    rejectedCount,
    totalGross,
    totalNet,
    totalPaid,
    totalDue,
    averageNetPayable: totalLedgers ? Number((totalNet / totalLedgers).toFixed(2)) : 0,
    topKarikars: topKarikarList,
  };
};

export const approveKarikarWageLedger = async (
  wageLedgerId: string,
  approverId: string,
  payload: Record<string, unknown> = {}
) => {
  const result = await withMongoTransaction(async (session) => {
    const ledger = await KarikarWageLedger.findOne({ wageLedgerId }).session(session as any);
    if (!ledger) throw new Error('Wage ledger request not found');
    if (ledger.status !== 'PENDING') throw new Error(`Cannot approve ledger in status ${ledger.status}`);

    ledger.status = 'APPROVED';
    ledger.approvedBy = approverId;
    ledger.approvedAt = new Date();
    ledger.adminNotes = normalize(payload.adminNotes) || ledger.adminNotes;
    ledger.updatedAt = new Date();
    await ledger.save({ session });

    const storeId = getCurrentStoreId();
    await Notification.create([
      {
        notificationId: `KARIKAR_WAGE_APPROVED_${ledger.wageLedgerId}`,
        tenantId: storeId,
        storeId,
        type: 'KARIKAR_WAGE_LEDGER_APPROVED',
        title: 'Wage request approved',
        message: `Your wage ledger ${ledger.wageLedgerId} has been approved.`,
        category: 'Wages',
        severity: 'INFO',
        channels: ['IN_APP'],
        reference: ledger.wageLedgerId,
        relatedEntityId: ledger.karikarId,
        sendAt: new Date(),
        status: 'PENDING',
      },
    ], { session });

    return ledger.toObject();
  });

  await KarikarAuditLog.create({
    karikarId: result.karikarId,
    action: 'karikar-wage-ledger-approved',
    details: 'Karikar wage ledger request approved',
    metadata: { wageLedgerId: result.wageLedgerId, approverId },
  });

  await logSecurityEvent(approverId, 'karikar-wage-ledger-approve', result.wageLedgerId, `Approved wage ledger ${result.wageLedgerId}`);
  return result;
};

export const rejectKarikarWageLedger = async (
  wageLedgerId: string,
  approverId: string,
  rejectionReason: string
) => {
  const result = await withMongoTransaction(async (session) => {
    const ledger = await KarikarWageLedger.findOne({ wageLedgerId }).session(session as any);
    if (!ledger) throw new Error('Wage ledger request not found');
    if (ledger.status !== 'PENDING') throw new Error(`Cannot reject ledger in status ${ledger.status}`);

    ledger.status = 'REJECTED';
    ledger.rejectedAt = new Date();
    ledger.rejectionReason = rejectionReason;
    ledger.adminNotes = rejectionReason;
    ledger.updatedAt = new Date();
    await ledger.save({ session });

    const karikar = await Karikar.findById(ledger.karikarId).session(session as any);
    if (karikar) {
      karikar.ledgerBalance = Math.max(0, Number(karikar.ledgerBalance || 0) - Number(ledger.balanceDue || 0));
      karikar.updatedAt = new Date();
      await karikar.save({ session });
    }

    const storeId = getCurrentStoreId();
    await Notification.create([
      {
        notificationId: `KARIKAR_WAGE_REJECTED_${ledger.wageLedgerId}`,
        tenantId: storeId,
        storeId,
        type: 'KARIKAR_WAGE_LEDGER_REJECTED',
        title: 'Wage request rejected',
        message: `Your wage ledger ${ledger.wageLedgerId} was rejected. Reason: ${rejectionReason}`,
        category: 'Wages',
        severity: 'WARNING',
        channels: ['IN_APP'],
        reference: ledger.wageLedgerId,
        relatedEntityId: ledger.karikarId,
        sendAt: new Date(),
        status: 'PENDING',
      },
    ], { session });

    return ledger.toObject();
  });

  await KarikarAuditLog.create({
    karikarId: result.karikarId,
    action: 'karikar-wage-ledger-rejected',
    details: 'Karikar wage ledger request rejected',
    metadata: { wageLedgerId: result.wageLedgerId, approverId, rejectionReason },
  });

  await logSecurityEvent(approverId, 'karikar-wage-ledger-reject', result.wageLedgerId, `Rejected wage ledger ${result.wageLedgerId}`);
  return result;
};

export const payKarikarWageLedger = async (
  wageLedgerId: string,
  payerId: string,
  payload: Record<string, unknown>
) => {
  const result = await withMongoTransaction(async (session) => {
    const ledger = await KarikarWageLedger.findOne({ wageLedgerId }).session(session as any);
    if (!ledger) throw new Error('Wage ledger request not found');
    if (ledger.status === 'REJECTED' || ledger.status === 'PAID') {
      throw new Error(`Cannot pay ledger in status ${ledger.status}`);
    }

    const amount = Number(payload.amount ?? 0);
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const paymentMethod = normalize(payload.paymentMethod) || 'CASH';
    const paymentReference = normalize(payload.paymentReference);
    const note = normalize(payload.note);

    if (amount > Number(ledger.balanceDue || ledger.netPayable || 0)) {
      throw new Error('Payment amount cannot exceed balance due');
    }

    const newPaidAmount = Number(ledger.paidAmount || 0) + amount;
    const balanceDue = Math.max(0, Number(ledger.netPayable || 0) - newPaidAmount);

    ledger.paidAmount = newPaidAmount;
    ledger.balanceDue = balanceDue;
    ledger.paymentMethod = paymentMethod;
    ledger.paymentReference = paymentReference;
    ledger.paidAt = new Date();
    ledger.adminNotes = note || ledger.adminNotes;
    ledger.updatedAt = new Date();
    ledger.status = balanceDue > 0 ? 'PARTIAL' : 'PAID';
    await ledger.save({ session });

    const karikar = await Karikar.findById(ledger.karikarId).session(session as any);
    if (karikar) {
      karikar.ledgerBalance = Math.max(0, Number(karikar.ledgerBalance || 0) - amount);
      karikar.updatedAt = new Date();
      await karikar.save({ session });
    }

    const storeId = getCurrentStoreId();
    await Notification.create([
      {
        notificationId: `KARIKAR_WAGE_PAID_${ledger.wageLedgerId}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        tenantId: storeId,
        storeId,
        type: 'KARIKAR_WAGE_LEDGER_PAID',
        title: 'Wage payment recorded',
        message: `Payment of ${amount} has been recorded for wage ledger ${ledger.wageLedgerId}.`,
        category: 'Wages',
        severity: 'INFO',
        channels: ['IN_APP'],
        reference: ledger.wageLedgerId,
        relatedEntityId: ledger.karikarId,
        sendAt: new Date(),
        status: 'PENDING',
      },
    ], { session });

    return ledger.toObject();
  });

  await KarikarAuditLog.create({
    karikarId: result.karikarId,
    action: 'karikar-wage-ledger-paid',
    details: `Payment recorded for wage ledger ${result.wageLedgerId}`,
    metadata: { wageLedgerId: result.wageLedgerId, payerId, amount: Number(payload.amount ?? 0), paymentMethod: normalize(payload.paymentMethod), paymentReference: normalize(payload.paymentReference), balanceDue: result.balanceDue },
  });

  await logSecurityEvent(payerId, 'karikar-wage-ledger-pay', result.wageLedgerId, `Paid ${Number(payload.amount ?? 0)} for wage ledger ${result.wageLedgerId}`);
  return result;
};
