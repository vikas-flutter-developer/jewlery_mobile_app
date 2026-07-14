import express from 'express';
import { authMiddleware, roleMiddleware } from '../../lib/authUtils.js';
import { 
  clockShift, 
  getUsers, 
  updateUser, 
  getAllAttendance, 
  getStaffPerformance,
  getUserSchedule,
  updateUserSchedule,
  createUser,
  deleteUser,
  blockUser,
  activateUser,
  deactivateUser,
  forcePasswordReset,
  logoutAllSessions,
  getUserActionsHistory
} from '../controllers/users/usersController.js';

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), getUsers);
router.post('/', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER']), createUser);
router.get('/attendance', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), getAllAttendance);
router.get('/performance', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), getStaffPerformance);
router.get('/actions-history', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER', 'SUPER_ADMIN']), getUserActionsHistory);
router.put('/:id', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER']), updateUser);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), deleteUser);
router.post('/:id/shift', authMiddleware, clockShift);

// Feature 171: Shift scheduling routes
router.get('/:id/schedule', authMiddleware, getUserSchedule);
router.put('/:id/schedule', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), updateUserSchedule);

// Administrative User Actions
router.put('/:id/block', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER', 'SUPER_ADMIN']), blockUser);
router.put('/:id/activate', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER', 'SUPER_ADMIN']), activateUser);
router.put('/:id/deactivate', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER', 'SUPER_ADMIN']), deactivateUser);
router.put('/:id/force-password-reset', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER', 'SUPER_ADMIN']), forcePasswordReset);
router.put('/:id/logout-all-sessions', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER', 'SUPER_ADMIN']), logoutAllSessions);

export default router;


