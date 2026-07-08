import bcrypt from 'bcryptjs';
import { Karikar, Notification } from '../../retailer/models/index.js';
import KarikarAuditLog from '../../models/KarikarAuditLog.js';
import { karikarRepository } from '../repositories/karikarRepository.js';
import { logSecurityEvent } from '../../lib/securityAudit.js';
import { tenantLocalStorage } from '../../lib/db.js';

const PASSWORD_STRENGTH_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : value);

export const validatePasswordStrength = (value: string) => PASSWORD_STRENGTH_RE.test(value);

const generateKarikarMetalReturnId = () => `KRMRET-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const getCurrentStoreId = () => tenantLocalStorage.getStore()?.tenantId || 'default-shop';

export const buildKarikarDashboard = async (karikar: any) => {
  const jobs = Array.isArray(karikar.jobCards) ? karikar.jobCards : [];
  const pendingReturnCount = Array.isArray(karikar.metalReturns) ? karikar.metalReturns.length : 0;
  const totalReturnedMetal = Array.isArray(karikar.metalReturns)
    ? karikar.metalReturns.reduce((sum: number, item: any) => sum + Number(item.weight || 0), 0)
    : 0;
  const notifications = await karikarRepository.listNotifications(String(karikar._id));
  const unreadNotifications = notifications.filter((item: any) => !item.readAt).length;
  const currentJobs = jobs.filter((job: any) => String(job.status || '').toUpperCase() !== 'RECEIVED').length;
  const pendingJobs = jobs.filter((job: any) => String(job.status || '').toUpperCase() === 'OPEN').length;
  const completedToday = jobs.filter((job: any) => String(job.status || '').toUpperCase() === 'RECEIVED').length;
  const dueToday = jobs.filter((job: any) => String(job.status || '').toUpperCase() !== 'RECEIVED').length;
  const overdueJobs = jobs.filter((job: any) => {
    if (!job.dueDate) return false;
    return new Date(job.dueDate).getTime() < Date.now();
  }).length;
  const metalIssued = jobs.reduce((sum: number, job: any) => sum + Number(job.issuedGoldWeight || 0), 0);
  const todayEarnings = jobs.reduce((sum: number, job: any) => sum + Number(job.makingChargeEarned || 0), 0);
  const weeklyEarnings = todayEarnings;
  const ledgerBalance = Number(karikar.ledgerBalance || 0);
  const recentActivities = jobs.slice(0, 5).map((job: any) => ({
    title: `Job ${job.orderId || job._id}`,
    detail: job.status || 'OPEN',
    createdAt: job.issuedAt || job.receivedAt || new Date().toISOString(),
  }));

  return {
    currentJobs,
    pendingJobs,
    completedToday,
    dueToday,
    overdueJobs,
    metalIssued,
    pendingMetalReturn: pendingReturnCount,
    unreadNotifications,
    todayEarnings,
    weeklyEarnings,
    ledgerBalance,
    recentActivities,
    metalReturnedWeight: totalReturnedMetal,
    recentNotifications: notifications.slice(0, 5),
    highPriorityNotifications: notifications.filter((item: any) => item.severity === 'CRITICAL').slice(0, 5),
  };
};

export const getKarikarById = async (id: string) => {
  return Karikar.findById(id).lean();
};

export const updateKarikarProfile = async (id: string, payload: Record<string, unknown>) => {
  const update: Record<string, unknown> = {};
  const allowedFields = ['phone', 'email', 'emergencyContact', 'address', 'profilePhoto'];
  for (const field of allowedFields) {
    if (payload[field] !== undefined) update[field] = normalize(payload[field]);
  }
  if (!Object.keys(update).length) return null;
  const karikar = await Karikar.findById(id);
  if (!karikar) return null;
  Object.assign(karikar, update, { updatedAt: new Date() });
  await karikar.save();
  await KarikarAuditLog.create({ karikarId: id, action: 'profile-update', details: 'Karikar profile updated', metadata: update });
  return karikar.toObject();
};

export const changeKarikarPassword = async (id: string, payload: Record<string, unknown>) => {
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');
  const confirmPassword = String(payload.confirmPassword || '');
  const karikar = await Karikar.findById(id);
  if (!karikar) throw new Error('Karikar not found');
  if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
  if (!validatePasswordStrength(newPassword)) throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character');
  const storedPassword = String(karikar.password || '');
  const matches = storedPassword
    ? await bcrypt.compare(currentPassword, storedPassword)
    : currentPassword === newPassword;
  if (!matches) throw new Error('Current password is incorrect');
  karikar.password = await bcrypt.hash(newPassword, 10);
  karikar.sessions = [];
  karikar.updatedAt = new Date();
  await karikar.save();
  await KarikarAuditLog.create({ karikarId: id, action: 'password-change', details: 'Karikar password changed', metadata: { changedAt: new Date().toISOString() } });
  await logSecurityEvent(karikar.email || id, 'password-change', id, 'Karikar password changed');
  return karikar;
};

export const listKarikarSessions = async (id: string) => {
  const karikar = await Karikar.findById(id).lean();
  return Array.isArray(karikar?.sessions) ? karikar.sessions : [];
};

export const logoutAllKarikarSessions = async (id: string) => {
  const karikar = await Karikar.findById(id);
  if (!karikar) throw new Error('Karikar not found');
  karikar.sessions = [];
  await karikar.save();
  await KarikarAuditLog.create({ karikarId: id, action: 'logout-all', details: 'All sessions revoked' });
  return true;
};

export const listKarikarNotifications = async (id: string) => {
  return karikarRepository.listNotifications(id);
};

export const listKarikarMetalReturns = async (id: string) => {
  const karikar = await Karikar.findById(id).lean();
  return Array.isArray(karikar?.metalReturns) ? karikar.metalReturns : [];
};

export const getKarikarMetalReturn = async (id: string, returnId: string) => {
  const returns = await listKarikarMetalReturns(id);
  return returns.find((item: any) => String(item.returnId || item._id) === String(returnId)) || null;
};

export const createKarikarMetalReturn = async (id: string, payload: Record<string, unknown>) => {
  const karikar = await Karikar.findById(id);
  if (!karikar) throw new Error('Karikar not found');

  const weight = Number(payload.weight || 0);
  const purity = normalize(payload.purity) || '22K';
  const note = normalize(payload.note);

  if (weight <= 0) {
    throw new Error('Return weight must be greater than 0');
  }

  const returnEntry: any = {
    returnId: generateKarikarMetalReturnId(),
    weight,
    purity,
    note,
    status: 'COMPLETED',
    createdAt: new Date(),
    requestedAt: new Date(),
    returnedAt: new Date(),
    updatedAt: new Date(),
  };

  if (!Array.isArray(karikar.metalReturns)) {
    karikar.metalReturns = [];
  }
  karikar.metalReturns.push(returnEntry);
  karikar.goldStock = Math.max(0, Number(karikar.goldStock || 0) - weight);
  karikar.updatedAt = new Date();
  await karikar.save();

  await KarikarAuditLog.create({
    karikarId: id,
    action: 'metal-return',
    details: 'Karikar metal return recorded',
    metadata: returnEntry,
  });

  const storeId = getCurrentStoreId();
  await Notification.create({
    notificationId: `KARIKAR_RETURN_${returnEntry.returnId}`,
    tenantId: storeId,
    storeId,
    type: 'METAL_RETURN',
    title: 'Metal return recorded',
    message: `Metal return of ${weight}g (${purity}) has been recorded.`, 
    category: 'Metal Return',
    severity: 'INFO',
    channels: ['IN_APP'],
    reference: returnEntry.returnId,
    relatedEntityId: id,
    sendAt: new Date(),
    status: 'PENDING',
  });

  await logSecurityEvent(karikar.email || id, 'karikar-metal-return', id, `Karikar returned ${weight}g of ${purity}`);
  return returnEntry;
};

export const getKarikarMetalReturnSummary = async (id: string) => {
  const returns = await listKarikarMetalReturns(id);
  const totalWeight = returns.reduce((sum: number, item: any) => sum + Number(item.weight || 0), 0);
  const pendingCount = returns.filter((item: any) => String(item.status).toUpperCase() === 'PENDING').length;
  return {
    totalReturns: returns.length,
    totalWeight,
    pendingCount,
  };
};

export const markKarikarNotificationsRead = async (id: string, notificationIds: string[]) => {
  const result = await Notification.updateMany({ relatedEntityId: id, _id: { $in: notificationIds } }, { $set: { readAt: new Date() } });
  return result.modifiedCount || 0;
};
