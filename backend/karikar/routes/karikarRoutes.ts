import express from 'express';
import { authMiddleware } from '../../lib/authUtils.js';
import {
  changeKarikarPassword,
  createKarikarMetalReturn,
  getKarikarDashboard,
  getKarikarMetalReturn,
  getKarikarMetalReturnSummary,
  getKarikarProfile,
  listKarikarMetalReturns,
  listKarikarNotifications,
  listKarikarSessions,
  logoutAllKarikarSessions,
  markKarikarNotificationsRead,
  updateKarikarProfile,
} from '../controllers/karikarController.js';
import {
  createKarikarWastageReconciliation,
  getKarikarWastageReconciliation,
  getKarikarWastageReconciliationSummary,
  listKarikarWastageReconciliations,
} from '../controllers/wastageReconciliationController.js';
import {
  createKarikarWageLedger,
  getKarikarWageLedger,
  getKarikarWageLedgerSummary,
  listKarikarWageLedgers,
} from '../controllers/wageLedgerController.js';

const router = express.Router();

router.get('/dashboard', authMiddleware, getKarikarDashboard);
router.get('/profile', authMiddleware, getKarikarProfile);
router.put('/profile', authMiddleware, updateKarikarProfile);
router.put('/change-password', authMiddleware, changeKarikarPassword);
router.get('/sessions', authMiddleware, listKarikarSessions);
router.post('/logout-all', authMiddleware, logoutAllKarikarSessions);
router.get('/notifications', authMiddleware, listKarikarNotifications);
router.post('/notifications/read', authMiddleware, markKarikarNotificationsRead);
router.get('/metal-returns', authMiddleware, listKarikarMetalReturns);
router.get('/metal-returns/summary', authMiddleware, getKarikarMetalReturnSummary);
router.get('/metal-returns/:returnId', authMiddleware, getKarikarMetalReturn);
router.post('/metal-returns', authMiddleware, createKarikarMetalReturn);

router.get('/wastage-reconciliations', authMiddleware, listKarikarWastageReconciliations);
router.get('/wastage-reconciliations/summary', authMiddleware, getKarikarWastageReconciliationSummary);
router.get('/wastage-reconciliations/:reconciliationId', authMiddleware, getKarikarWastageReconciliation);
router.post('/wastage-reconciliations', authMiddleware, createKarikarWastageReconciliation);

router.get('/wage-ledgers', authMiddleware, listKarikarWageLedgers);
router.get('/wage-ledgers/summary', authMiddleware, getKarikarWageLedgerSummary);
router.get('/wage-ledgers/:ledgerId', authMiddleware, getKarikarWageLedger);
router.post('/wage-ledgers', authMiddleware, createKarikarWageLedger);

export default router;
