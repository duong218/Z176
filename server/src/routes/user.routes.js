import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, requireRoleCodes } from '../middlewares/auth.middleware.js';
import { requirePasswordChanged } from '../middlewares/require-password-changed.middleware.js';
import { uploadExcel } from '../middlewares/upload.middleware.js';
import { ApiError } from '../utils/api-error.js';

const router = Router();
const adminOnly = requireRoleCodes('admin');

router.use(authenticate, adminOnly, requirePasswordChanged);

router.get('/', userController.list);

router.post(
  '/import',
  (req, res, next) => {
    uploadExcel(req, res, (err) => {
      if (err instanceof ApiError) {
        next(err);
        return;
      }
      if (err) {
        next(new ApiError(400, err.message ?? 'Upload thất bại', 'IMPORT_UPLOAD_ERROR'));
        return;
      }
      next();
    });
  },
  userController.importExcel,
);

router.post('/', userController.create);
router.patch('/:id/role', userController.updateRole);
router.patch('/:id/lock', userController.toggleLock);
router.post('/:id/reset-password', userController.resetPassword);

export default router;