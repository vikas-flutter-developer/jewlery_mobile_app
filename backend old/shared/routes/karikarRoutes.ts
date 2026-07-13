import express, { Request, Response, NextFunction } from 'express';
import { authMiddleware, roleMiddleware, AuthRequest } from '../../lib/authUtils.js';
import {
  getManufacturerKarikars,
  getManufacturerKarikarSelfService,
  recordManufacturerKarikarMetalReturn,
} from '../../manufacturer/controllers/vendors/vendorsController.js';

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────────────────
 * KARIKAR SELF-SERVICE ROUTES (Shared Layer)
 * ─────────────────────────────────────────────────────────────────────────
 * These routes allow:
 * 1. KARIKAR users to view their own self-service data
 * 2. ADMIN users to view karikar data
 *
 * Authentication: Required (authMiddleware)
 * Authorization: KARIKAR or ADMIN role
 */

/**
 * GET /karikars
 * List all karikars (ADMIN only for manufacturing context)
 * KARIKAR users use /karikars/:id/self-service for their own data
 */
router.get('/', authMiddleware, roleMiddleware(['ADMIN', 'KARIKAR']), getManufacturerKarikars);

/**
 * GET /karikars/:id/self-service
 * Karikar self-service portal - view their job cards, settlements, metal returns, gold stock, ledger
 *
 * Access:
 * - KARIKAR: can only access their own data (id must match user.id)
 * - ADMIN: can access any karikar's data
 */
router.get('/:id/self-service', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  const requestedId = req.params.id;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  console.log(`[Karikar Self-Service] User role: ${user.role}, userId: ${user.id}, requestedId: ${requestedId}`);
  
  // KARIKAR users can only view their own self-service data
  if (user.role === 'KARIKAR' && user.id !== requestedId) {
    console.log(`[Karikar Self-Service] Authorization denied: KARIKAR user ${user.id} tried to access ${requestedId}`);
    return res.status(403).json({
      success: false,
      error: 'You can only view your own self-service data'
    });
  }
  
  // ADMIN or KARIKAR viewing their own → proceed
  if (user.role === 'KARIKAR' || user.role === 'ADMIN') {
    console.log(`[Karikar Self-Service] Authorization granted for ${user.role}`);
    return getManufacturerKarikarSelfService(req, res);
  }
  
  console.log(`[Karikar Self-Service] Authorization denied: role '${user.role}' not permitted`);
  return res.status(403).json({
    success: false,
    error: 'Insufficient permissions to access karikar data'
  });
});

/**
 * POST /karikars/:id/returns
 * Record metal returns for a karikar
 *
 * Access:
 * - KARIKAR: can only record returns for themselves
 * - ADMIN: can record returns for any karikar
 */
router.post('/:id/returns', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = req.user;
  const requestedId = req.params.id;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  console.log(`[Karikar Metal Return] User role: ${user.role}, userId: ${user.id}, requestedId: ${requestedId}`);
  
  // KARIKAR users can only record returns for themselves
  if (user.role === 'KARIKAR' && user.id !== requestedId) {
    console.log(`[Karikar Metal Return] Authorization denied: KARIKAR user ${user.id} tried to record returns for ${requestedId}`);
    return res.status(403).json({
      success: false,
      error: 'You can only record returns for yourself'
    });
  }
  
  // ADMIN or KARIKAR recording their own → proceed
  if (user.role === 'KARIKAR' || user.role === 'ADMIN') {
    console.log(`[Karikar Metal Return] Authorization granted for ${user.role}`);
    return recordManufacturerKarikarMetalReturn(req, res);
  }
  
  console.log(`[Karikar Metal Return] Authorization denied: role '${user.role}' not permitted`);
  return res.status(403).json({
    success: false,
    error: 'Insufficient permissions to record metal returns'
  });
});

export default router;
