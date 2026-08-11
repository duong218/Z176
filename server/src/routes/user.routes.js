import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, requireRoleCodes } from '../middlewares/auth.middleware.js';
import { requirePasswordChanged } from '../middlewares/require-password-changed.middleware.js';

const router = Router();
const adminOnly = requireRoleCodes('admin');

router.use(authenticate, adminOnly, requirePasswordChanged);

router.get('/', userController.list);
router.post('/', userController.create);
router.patch('/:id/role', userController.updateRole);
router.patch('/:id/lock', userController.toggleLock);
router.post('/:id/reset-password', userController.resetPassword);

export default router;
