import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { authenticate, requireRoleCodes } from '../middlewares/auth.middleware.js';

const router = Router();

// Thí sinh xem lịch sử kết quả thi CỦA CHÍNH MÌNH.
// Đặt route này TRƯỚC router.use(...) bên dưới — nếu để sau, middleware
// requireRoleCodes('leader', 'admin') sẽ áp dụng luôn cho route này và
// chặn mọi thí sinh (role 'candidate') truy cập.
router.get('/my-results', authenticate, requireRoleCodes('candidate'), reportController.getMyResults);

// Người duyệt đề và Admin có quyền xem báo cáo tổng hợp toàn hệ thống
router.use(authenticate, requireRoleCodes('leader', 'admin'));

router.get('/overview', reportController.getOverviewStats);
router.get('/by-department', reportController.getResultsByDepartment);
router.get('/results', reportController.getDetailedResults);
router.get('/export', reportController.exportDetailedResultsExcel);

export const reportRoutes = router;