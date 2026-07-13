import { Karikar, Notification, WastageReconciliation } from '../../retailer/models/index.js';
import KarikarAuditLog from '../../models/KarikarAuditLog.js';
import { logSecurityEvent } from '../../lib/securityAudit.js';
import { tenantLocalStorage } from '../../lib/db.js';
import { withMongoTransaction } from '../../lib/mongoTransaction.js';

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const getCurrentStoreId = () => tenantLocalStorage.getStore()?.tenantId || 'default-shop';
const generateReconciliationId = () => `KRW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const createKarikarWastageReconciliation = async (karikarId: string, payload: Record<string, unknown>) => {
  const karikar = await Karikar.findById(karikarId);
  if (!karikar) throw new Error('Karikar not found');

  const requestedWeight = Number(payload.requestedWeight || payload.weight || 0);
  const purity = normalize(payload.purity) || '22K';
  const scrapWeight = Number(payload.scrapWeight || 0);
  const estimatedWastage = Number(payload.estimatedWastage || 0);
  const actualWastage = Number(payload.actualWastage || 0);
  const calculatedLoss = Number(payload.calculatedLoss || 0);
  const notes = normalize(payload.notes);
  const jobId = normalize(payload.jobId);
  const orderId = normalize(payload.orderId);
  const metadata = typeof payload.metadata === 'object' && payload.metadata !== null ? payload.metadata : {};

  if (requestedWeight <= 0) {
    throw new Error('Requested weight must be greater than 0');
  }
  if (scrapWeight < 0) {
    throw new Error('Scrap weight cannot be negative');
  }
  if (estimatedWastage < 0) {
    throw new Error('Estimated wastage cannot be negative');
  }

  const reconciliationRecord = new WastageReconciliation({
    reconciliationId: generateReconciliationId(),
    karikarId,
    jobId: jobId || undefined,
    orderId: orderId || undefined,
    requestedWeight,
    purity,
    scrapWeight,
    estimatedWastage,
    actualWastage,
    calculatedLoss,
    notes,
    requestedBy: 'KARIKAR',
    status: 'PENDING',
    requestedAt: new Date(),
    updatedAt: new Date(),
    metadata,
  });

  const storeId = getCurrentStoreId();
  await withMongoTransaction(async (session) => {
    await reconciliationRecord.save({ session });
    await Notification.create([
      {
        notificationId: `KARIKAR_WASTAGE_REQ_${reconciliationRecord.reconciliationId}`,
        tenantId: storeId,
        storeId,
        type: 'WASTAGE_RECONCILIATION_REQUEST',
        title: 'New wastage reconciliation request',
        message: `Karikar submitted a wastage reconciliation request for ${requestedWeight}g of ${purity}.`,
        category: 'Wastage Reconciliation',
        severity: 'INFO',
        channels: ['IN_APP'],
        reference: reconciliationRecord.reconciliationId,
        relatedEntityId: karikarId,
        sendAt: new Date(),
        status: 'PENDING',
      },
    ], { session });
  });

  await KarikarAuditLog.create({
    karikarId,
    action: 'wastage-reconciliation-request',
    details: 'Karikar created a wastage reconciliation request',
    metadata: {
      reconciliationId: reconciliationRecord.reconciliationId,
      jobId,
      orderId,
      requestedWeight,
      purity,
    },
  });

  await logSecurityEvent(karikar.email || karikarId, 'karikar-wastage-request', karikarId, `Wastage reconciliation requested: ${reconciliationRecord.reconciliationId}`);

  return reconciliationRecord.toObject();
};

export const listKarikarWastageReconciliations = async (karikarId: string) => {
  return WastageReconciliation.find({ karikarId }).sort({ requestedAt: -1 }).lean();
};

export const getKarikarWastageReconciliation = async (karikarId: string, reconciliationId: string) => {
  return WastageReconciliation.findOne({ karikarId, reconciliationId }).lean();
};

export const getKarikarWastageReconciliationSummary = async (karikarId: string) => {
  const records = await listKarikarWastageReconciliations(karikarId);
  const totalRequests = records.length;
  const pendingCount = records.filter((r: any) => r.status === 'PENDING').length;
  const approvedCount = records.filter((r: any) => r.status === 'APPROVED').length;
  const rejectedCount = records.filter((r: any) => r.status === 'REJECTED').length;
  const completedCount = records.filter((r: any) => r.status === 'COMPLETED').length;
  const totalRequestedWeight = records.reduce((sum: number, r: any) => sum + Number(r.requestedWeight || 0), 0);
  const totalActualWastage = records.reduce((sum: number, r: any) => sum + Number(r.actualWastage || 0), 0);
  return {
    totalRequests,
    pendingCount,
    approvedCount,
    rejectedCount,
    completedCount,
    totalRequestedWeight,
    totalActualWastage,
    averageRequestedWeight: totalRequests ? Number((totalRequestedWeight / totalRequests).toFixed(2)) : 0,
  };
};

export const listAllWastageReconciliations = async (filters: { karikarId?: string; status?: string; fromDate?: Date | null; toDate?: Date | null } = {}) => {
  const query: Record<string, unknown> = {};
  if (filters.karikarId) query.karikarId = filters.karikarId;
  if (filters.status) query.status = filters.status.toUpperCase();
  if (filters.fromDate || filters.toDate) {
    query.requestedAt = {} as Record<string, Date>;
    if (filters.fromDate) (query.requestedAt as any).$gte = filters.fromDate;
    if (filters.toDate) (query.requestedAt as any).$lte = filters.toDate;
  }
  return WastageReconciliation.find(query).sort({ requestedAt: -1 }).lean();
};

export const getAllWastageReconciliationSummary = async (filters: { karikarId?: string; status?: string; fromDate?: Date | null; toDate?: Date | null } = {}) => {
  const records = await listAllWastageReconciliations(filters);
  const totalRequests = records.length;
  const pendingCount = records.filter((r: any) => r.status === 'PENDING').length;
  const approvedCount = records.filter((r: any) => r.status === 'APPROVED').length;
  const rejectedCount = records.filter((r: any) => r.status === 'REJECTED').length;
  const completedCount = records.filter((r: any) => r.status === 'COMPLETED').length;
  const totalRequestedWeight = records.reduce((sum: number, r: any) => sum + Number(r.requestedWeight || 0), 0);
  const totalScrapWeight = records.reduce((sum: number, r: any) => sum + Number(r.scrapWeight || 0), 0);
  const totalEstimatedWastage = records.reduce((sum: number, r: any) => sum + Number(r.estimatedWastage || 0), 0);
  const totalActualWastage = records.reduce((sum: number, r: any) => sum + Number(r.actualWastage || 0), 0);

  const topKarikars = records.reduce((map: Record<string, any>, record: any) => {
    const key = record.karikarId;
    if (!map[key]) {
      map[key] = { karikarId: key, requests: 0, requestedWeight: 0, actualWastage: 0 };
    }
    map[key].requests += 1;
    map[key].requestedWeight += Number(record.requestedWeight || 0);
    map[key].actualWastage += Number(record.actualWastage || 0);
    return map;
  }, {} as Record<string, any>);

  const topKarikarList = Object.values(topKarikars)
    .sort((a: any, b: any) => b.requestedWeight - a.requestedWeight)
    .slice(0, 5);

  return {
    totalRequests,
    pendingCount,
    approvedCount,
    rejectedCount,
    completedCount,
    totalRequestedWeight,
    totalScrapWeight,
    totalEstimatedWastage,
    totalActualWastage,
    topKarikars: topKarikarList,
  };
};

export const approveKarikarWastageReconciliation = async (reconciliationId: string, approverId: string, payload: { actualWastage?: unknown; calculatedLoss?: unknown; notes?: unknown } = {}) => {
  const reconciliation = await WastageReconciliation.findOne({ reconciliationId });
  if (!reconciliation) throw new Error('Wastage reconciliation request not found');
  if (reconciliation.status !== 'PENDING') throw new Error(`Cannot approve request with status ${reconciliation.status}`);

  const actualWastage = payload.actualWastage !== undefined ? Number(payload.actualWastage) : reconciliation.actualWastage;
  const calculatedLoss = payload.calculatedLoss !== undefined ? Number(payload.calculatedLoss) : reconciliation.calculatedLoss;
  const notes = normalize(payload.notes) || reconciliation.notes;

  reconciliation.status = 'APPROVED';
  reconciliation.approvedBy = approverId;
  reconciliation.approvedAt = new Date();
  reconciliation.actualWastage = actualWastage;
  reconciliation.calculatedLoss = calculatedLoss;
  reconciliation.notes = notes;
  reconciliation.updatedAt = new Date();

  await reconciliation.save();

  await KarikarAuditLog.create({
    karikarId: reconciliation.karikarId,
    action: 'wastage-reconciliation-approved',
    details: 'Wastage reconciliation request approved',
    metadata: { reconciliationId: reconciliation.reconciliationId, approverId, actualWastage, calculatedLoss },
  });

  await logSecurityEvent(approverId, 'wastage-reconciliation-approve', reconciliation.reconciliationId, `Approved wastage reconciliation ${reconciliation.reconciliationId}`);

  const storeId = getCurrentStoreId();
  await Notification.create({
    notificationId: `KARIKAR_WASTAGE_APPROVED_${reconciliation.reconciliationId}`,
    tenantId: storeId,
    storeId,
    type: 'WASTAGE_RECONCILIATION_APPROVED',
    title: 'Wastage reconciliation approved',
    message: `Your reconciliation request ${reconciliation.reconciliationId} has been approved.`,
    category: 'Wastage Reconciliation',
    severity: 'INFO',
    channels: ['IN_APP'],
    reference: reconciliation.reconciliationId,
    relatedEntityId: reconciliation.karikarId,
    sendAt: new Date(),
    status: 'PENDING',
  });

  return reconciliation.toObject();
};

export const rejectKarikarWastageReconciliation = async (reconciliationId: string, approverId: string, rejectionReason: string) => {
  const reconciliation = await WastageReconciliation.findOne({ reconciliationId });
  if (!reconciliation) throw new Error('Wastage reconciliation request not found');
  if (reconciliation.status !== 'PENDING') throw new Error(`Cannot reject request with status ${reconciliation.status}`);

  reconciliation.status = 'REJECTED';
  reconciliation.rejectedAt = new Date();
  reconciliation.approvedBy = approverId;
  reconciliation.rejectionReason = rejectionReason;
  reconciliation.updatedAt = new Date();
  await reconciliation.save();

  await KarikarAuditLog.create({
    karikarId: reconciliation.karikarId,
    action: 'wastage-reconciliation-rejected',
    details: 'Wastage reconciliation request rejected',
    metadata: { reconciliationId: reconciliation.reconciliationId, approverId, rejectionReason },
  });

  await logSecurityEvent(approverId, 'wastage-reconciliation-reject', reconciliation.reconciliationId, `Rejected wastage reconciliation ${reconciliation.reconciliationId}`);

  const storeId = getCurrentStoreId();
  await Notification.create({
    notificationId: `KARIKAR_WASTAGE_REJECTED_${reconciliation.reconciliationId}`,
    tenantId: storeId,
    storeId,
    type: 'WASTAGE_RECONCILIATION_REJECTED',
    title: 'Wastage reconciliation rejected',
    message: `Your reconciliation request ${reconciliation.reconciliationId} has been rejected. Reason: ${rejectionReason}`,
    category: 'Wastage Reconciliation',
    severity: 'WARNING',
    channels: ['IN_APP'],
    reference: reconciliation.reconciliationId,
    relatedEntityId: reconciliation.karikarId,
    sendAt: new Date(),
    status: 'PENDING',
  });

  return reconciliation.toObject();
};
