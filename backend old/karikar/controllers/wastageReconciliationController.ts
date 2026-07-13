import { Request, Response } from 'express';
import { AuthRequest } from '../../lib/authUtils.js';
import {
  createKarikarWastageReconciliation as createKarikarWastageReconciliationService,
  getKarikarWastageReconciliation as getKarikarWastageReconciliationService,
  getKarikarWastageReconciliationSummary as getKarikarWastageReconciliationSummaryService,
  listKarikarWastageReconciliations as listKarikarWastageReconciliationsService,
} from '../services/wastageReconciliationService.js';

const requireKarikar = (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'KARIKAR') {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return null;
  }
  return req.user.id;
};

export const listKarikarWastageReconciliations = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const reconciliations = await listKarikarWastageReconciliationsService(karikarId);
    return res.status(200).json({ success: true, data: reconciliations });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load wastage reconciliations' });
  }
};

export const getKarikarWastageReconciliation = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const reconciliationId = String(req.params.reconciliationId || '');
    const reconciliation = await getKarikarWastageReconciliationService(karikarId, reconciliationId);
    if (!reconciliation) return res.status(404).json({ success: false, error: 'Wastage reconciliation request not found' });
    return res.status(200).json({ success: true, data: reconciliation });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load wastage reconciliation' });
  }
};

export const createKarikarWastageReconciliation = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const reconciliation = await createKarikarWastageReconciliationService(karikarId, req.body || {});
    return res.status(201).json({ success: true, data: reconciliation, message: 'Wastage reconciliation request created' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to create wastage reconciliation request' });
  }
};

export const getKarikarWastageReconciliationSummary = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const summary = await getKarikarWastageReconciliationSummaryService(karikarId);
    return res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load wastage reconciliation summary' });
  }
};
