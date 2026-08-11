import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { authenticate, requireRoleCodes } from '../middlewares/auth.middleware.js';

const router = Router();

// Người duyệt đề và Admin có quyền xem báo cáo
router.use(authenticate, requireRoleCodes('leader', 'admin'));

router.get('/overview', reportController.getOverviewStats);
router.get('/by-department', reportController.getResultsByDepartment);
router.get('/results', reportController.getDetailedResults);
router.get('/export', reportController.exportDetailedResultsExcel);

export const reportRoutes = router;
