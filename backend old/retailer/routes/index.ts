import express from 'express';
import { authMiddleware, roleMiddleware } from '../../lib/authUtils.js';
import inventoryRoutes from './inventoryRoutes.js';
import branchRoutes from './branchRoutes.js';
import customersRoutes from './customersRoutes.js';
import vendorsRoutes from './vendorsRoutes.js';
import salesRoutes from './salesRoutes.js';
import ordersRoutes from './ordersRoutes.js';
import costEstimateRoutes from './costEstimateRoutes.js';
import khataRoutes from './khataRoutes.js';
import ratesRoutes from './ratesRoutes.js';
import paymentsRoutes from './paymentsRoutes.js';
import returnsRoutes from './returnsRoutes.js';
import schemesRoutes from './schemesRoutes.js';
import posRoutes from './posRoutes.js';
import financeRoutes from './financeRoutes.js';
import barcodesRoutes from './barcodesRoutes.js';
import oldGoldRoutes from './oldGoldRoutes.js';
import reportsRoutes from './reportsRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import accountingRoutes from './accountingRoutes.js';
import ledgersRoutes from './ledgersRoutes.js';
import hallmarkingRoutes from './hallmarkingRoutes.js';
import huidRoutes from './huidRoutes.js';
import complianceRoutes from './complianceRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import repairRoutes from './repairRoutes.js';
import referralsRoutes from './referralsRoutes.js';
import referralPartnersRoutes from './referralPartnersRoutes.js';
import referralCommissionsRoutes from './referralCommissionsRoutes.js';
import referralPayoutsRoutes from './referralPayoutsRoutes.js';
import vendorContractsRoutes from './vendorContractsRoutes.js';
import vendorRateRulesRoutes from './vendorRateRulesRoutes.js';
import { getMySupportTickets, createSupportTicket } from '../../shared/controllers/support/supportController.js';

const router = express.Router();


// Retailer-specific modules
router.use('/inventory', inventoryRoutes);
router.use('/branches', branchRoutes);
router.use('/customers', customersRoutes);
router.use('/vendors', vendorsRoutes);
router.use('/sales', salesRoutes);
router.use('/orders', ordersRoutes);
router.use('/orders', costEstimateRoutes);
router.use('/khata', khataRoutes);
router.use('/rates', ratesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/returns', returnsRoutes);
router.use('/schemes', schemesRoutes);
router.use('/pos', posRoutes);
router.use('/finance', financeRoutes);
router.use('/barcodes', barcodesRoutes);
router.use('/old-gold', oldGoldRoutes);   // primary path
router.use('/oldgold', oldGoldRoutes);    // alias — frontend uses /oldgold/* prefix
router.get('/support/tickets', authMiddleware, roleMiddleware(['RETAILER']), getMySupportTickets);
router.post('/support/tickets', authMiddleware, roleMiddleware(['RETAILER']), createSupportTicket);
router.use('/repairs', repairRoutes);     // repair job management (was orphaned)
router.use('/reports', reportsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/accounting', accountingRoutes);
router.use('/ledgers', ledgersRoutes);
router.use('/hallmarking', hallmarkingRoutes);
router.use('/huid', huidRoutes);
router.use('/compliance', complianceRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/referrals', referralsRoutes);
router.use('/referral-partners', referralPartnersRoutes);
router.use('/referral-commissions', referralCommissionsRoutes);
router.use('/referral-payouts', referralPayoutsRoutes);
router.use('/vendor-contracts', vendorContractsRoutes);
router.use('/vendor-contract-rules', vendorRateRulesRoutes);


export default router;



