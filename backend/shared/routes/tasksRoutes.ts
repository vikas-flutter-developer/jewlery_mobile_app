import express from 'express';
import { authMiddleware } from '../../lib/authUtils.js';
import { getTasks, createTask, updateTask, addTaskComment } from '../controllers/users/tasksController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.post('/:id/comments', addTaskComment);

export default router;
