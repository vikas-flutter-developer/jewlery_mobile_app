import express from 'express';
import { 
  createScheme, 
  getSchemes, 
  enrollInScheme, 
  getEnrollments, 
  recordInstallment, 
  getMaturityList, 
  getDefaulters, 
  redeemScheme 
} from '../controllers/schemes/schemesController.js';
import { authMiddleware } from '../../lib/authUtils.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getSchemes);
router.post('/', createScheme);
router.get('/enrollments', getEnrollments);
router.post('/enroll', enrollInScheme);
router.post('/enrollments/:id/installments', recordInstallment);
router.get('/maturity', getMaturityList);
router.get('/defaulters', getDefaulters);
router.post('/enrollments/:id/redeem', redeemScheme);

export default router;


