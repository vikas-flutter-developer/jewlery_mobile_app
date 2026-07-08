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
  deleteUser
} from '../controllers/users/usersController.js';

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), getUsers);
router.post('/', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER']), createUser);
router.get('/attendance', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), getAllAttendance);
router.get('/performance', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), getStaffPerformance);
router.put('/:id', authMiddleware, roleMiddleware(['ADMIN', 'RETAILER']), updateUser);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), deleteUser);
router.post('/:id/shift', authMiddleware, clockShift);

// Feature 171: Shift scheduling routes
router.get('/:id/schedule', authMiddleware, getUserSchedule);
router.put('/:id/schedule', authMiddleware, roleMiddleware(['ADMIN', 'STORE_MANAGER', 'RETAILER']), updateUserSchedule);

export default router;


