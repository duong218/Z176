import { asyncHandler } from '../utils/async-handler.js';
import { reportService } from '../services/report.service.js';

export const reportController = {
  getOverviewStats: asyncHandler(async (req, res) => {
    const stats = await reportService.getOverviewStats();
    res.json({
      success: true,
      data: stats,
    });
  }),

  getResultsByDepartment: asyncHandler(async (req, res) => {
    const data = await reportService.getResultsByDepartment();
    res.json({
      success: true,
      data,
    });
  }),

  // PUBLIC — trang chủ, không đăng nhập. Chỉ tên phòng ban + tỷ lệ đạt.
  getPublicResultsByDepartment: asyncHandler(async (req, res) => {
    const data = await reportService.getPublicResultsByDepartment();
    res.json({
      success: true,
      data,
    });
  }),

  // PUBLIC — tra cứu kết quả cá nhân theo mã NV hoặc họ tên.
  lookupPublicResult: asyncHandler(async (req, res) => {
    const data = await reportService.lookupPublicResult(req.query.q);
    res.json({
      success: true,
      data,
    });
  }),

  getDetailedResults: asyncHandler(async (req, res) => {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      departmentId: req.query.departmentId,
      passed: req.query.passed,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
    };
    const data = await reportService.getDetailedResults(filters);
    res.json({
      success: true,
      data,
    });
  }),

  exportDetailedResultsExcel: asyncHandler(async (req, res) => {
    const filters = {
      departmentId: req.query.departmentId,
      passed: req.query.passed,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
    };
    const buffer = await reportService.exportDetailedResultsExcel(filters);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ket_qua_thi.xlsx"'
    );
    res.send(buffer);
  }),

  // MỚI — Lịch sử kết quả thi của chính thí sinh đang đăng nhập (role 'candidate').
  getMyResults: asyncHandler(async (req, res) => {
    const data = await reportService.getMyResults(req.auth.userId);
    res.json({
      success: true,
      data,
    });
  }),
};