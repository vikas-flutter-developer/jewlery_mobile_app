import { Request, Response } from 'express';
import { AuthRequest } from '../../lib/authUtils.js';
import {
  buildKarikarDashboard as buildDashboard,
  changeKarikarPassword as changePassword,
  getKarikarById,
  listKarikarMetalReturns as listMetalReturns,
  getKarikarMetalReturn as getMetalReturn,
  getKarikarMetalReturnSummary as getMetalReturnSummary,
  createKarikarMetalReturn as createMetalReturn,
  listKarikarNotifications as listNotifications,
  listKarikarSessions as listSessions,
  logoutAllKarikarSessions as revokeAllSessions,
  markKarikarNotificationsRead as markNotificationsRead,
  updateKarikarProfile as updateProfile,
  validatePasswordStrength,
} from '../services/karikarService.js';
import Karikar from '../../models/Karikar.js';
import KarikarAuditLog from '../../models/KarikarAuditLog.js';

const requireKarikar = (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'KARIKAR') {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return null;
  }
  return req.user.id;
};

export const getKarikarDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const karikar = await getKarikarById(karikarId);
    if (!karikar) return res.status(404).json({ success: false, error: 'Karikar not found' });
    const dashboard = await buildDashboard(karikar);
    await KarikarAuditLog.create({ karikarId, action: 'dashboard-access', details: 'Karikar dashboard accessed' });
    return res.status(200).json({ success: true, data: dashboard });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load dashboard' });
  }
};

export const getKarikarProfile = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const karikar = await getKarikarById(karikarId);
    if (!karikar) return res.status(404).json({ success: false, error: 'Karikar not found' });
    return res.status(200).json({ success: true, data: {
      _id: karikar._id,
      name: karikar.name,
      email: karikar.email,
      phone: karikar.phone,
      emergencyContact: karikar.emergencyContact,
      address: karikar.address,
      profilePhoto: karikar.profilePhoto,
      role: 'KARIKAR',
      permissions: ['dashboard', 'profile', 'jobs', 'notifications', 'ledger', 'metal'],
      branch: karikar.branchId || null,
      manufacturer: karikar.manufacturer || null,
      wage: karikar.wage || null,
      employeeCode: karikar.employeeCode || null,
      status: karikar.status,
    } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load profile' });
  }
};

export const updateKarikarProfile = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const updated = await updateProfile(karikarId, req.body || {});
    if (!updated) return res.status(400).json({ success: false, error: 'No valid profile fields provided' });
    return res.status(200).json({ success: true, data: updated, message: 'Profile updated' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to update profile' });
  }
};

export const changeKarikarPassword = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const payload = req.body || {};
    if (!payload.currentPassword || !payload.newPassword || !payload.confirmPassword) {
      return res.status(400).json({ success: false, error: 'All password fields are required' });
    }
    if (!validatePasswordStrength(String(payload.newPassword))) {
      return res.status(400).json({ success: false, error: 'Password strength requirement not met' });
    }
    const updated = await changePassword(karikarId, payload);
    return res.status(200).json({ success: true, data: updated, message: 'Password changed successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to change password' });
  }
};

export const listKarikarSessions = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const sessions = await listSessions(karikarId);
    return res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load sessions' });
  }
};

export const logoutAllKarikarSessions = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    await revokeAllSessions(karikarId);
    return res.status(200).json({ success: true, message: 'All sessions revoked' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to revoke sessions' });
  }
};

export const listKarikarNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const notifications = await listNotifications(karikarId);
    return res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load notifications' });
  }
};

export const listKarikarMetalReturns = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const returns = await listMetalReturns(karikarId);
    return res.status(200).json({ success: true, data: returns });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load metal return history' });
  }
};

export const getKarikarMetalReturn = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const returnId = String(req.params.returnId || '');
    const metalReturn = await getMetalReturn(karikarId, returnId);
    if (!metalReturn) return res.status(404).json({ success: false, error: 'Metal return record not found' });
    return res.status(200).json({ success: true, data: metalReturn });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load metal return record' });
  }
};

export const getKarikarMetalReturnSummary = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const summary = await getMetalReturnSummary(karikarId);
    return res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load metal return summary' });
  }
};

export const createKarikarMetalReturn = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const returnEntry = await createMetalReturn(karikarId, req.body || {});
    return res.status(201).json({ success: true, data: returnEntry, message: 'Metal return recorded' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to record metal return' });
  }
};

export const markKarikarNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const ids = Array.isArray(req.body?.notificationIds) ? req.body.notificationIds : [];
    const count = await markNotificationsRead(karikarId, ids);
    return res.status(200).json({ success: true, data: { markedRead: count } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to mark notifications read' });
  }
};
