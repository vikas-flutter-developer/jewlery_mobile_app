import { Request, Response } from 'express';
import { AuthRequest } from '../../lib/authUtils.js';
import {
  createKarikarWageLedgerRequest as createKarikarWageLedgerRequestService,
  getKarikarWageLedger as getKarikarWageLedgerService,
  getKarikarWageLedgerSummary as getKarikarWageLedgerSummaryService,
  listKarikarWageLedgers as listKarikarWageLedgersService,
} from '../services/karikarWageLedgerService.js';

const requireKarikar = (req: AuthRequest, res: Response) => {
  if (!req.user || req.user.role !== 'KARIKAR') {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return null;
  }
  return req.user.id;
};

export const listKarikarWageLedgers = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const records = await listKarikarWageLedgersService(karikarId);
    return res.status(200).json({ success: true, data: records });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load wage ledgers' });
  }
};

export const getKarikarWageLedger = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const wageLedgerId = String(req.params.ledgerId || '');
    const record = await getKarikarWageLedgerService(karikarId, wageLedgerId);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Wage ledger record not found' });
    }
    return res.status(200).json({ success: true, data: record });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load wage ledger' });
  }
};

export const getKarikarWageLedgerSummary = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const summary = await getKarikarWageLedgerSummaryService(karikarId);
    return res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to load wage ledger summary' });
  }
};

export const createKarikarWageLedger = async (req: AuthRequest, res: Response) => {
  try {
    const karikarId = requireKarikar(req, res);
    if (!karikarId) return;
    const record = await createKarikarWageLedgerRequestService(karikarId, req.body || {});
    return res.status(201).json({ success: true, data: record, message: 'Wage ledger request created' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to create wage ledger request' });
  }
};
