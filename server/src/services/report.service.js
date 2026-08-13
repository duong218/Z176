import mongoose from 'mongoose';
import xlsx from 'xlsx';
import { Result } from '../models/result.model.js';
import { Employee } from '../models/employee.model.js';

/**
 * Common aggregation pipeline to join Result -> ExamAttempt -> ExamCandidate -> Employee -> Department & Exam
 */
const getBasePipeline = () => [
  {
    $lookup: {
      from: 'examattempts',
      localField: 'examAttemptId',
      foreignField: '_id',
      as: 'attempt',
    },
  },
  { $unwind: '$attempt' },
  {
    $lookup: {
      from: 'examcandidates',
      localField: 'attempt.examCandidateId',
      foreignField: '_id',
      as: 'candidate',
    },
  },
  { $unwind: '$candidate' },
  {
    $lookup: {
      from: 'employees',
      localField: 'candidate.employeeId',
      foreignField: '_id',
      as: 'employee',
    },
  },
  { $unwind: '$employee' },
  {
    $lookup: {
      from: 'departments',
      localField: 'employee.departmentId',
      foreignField: '_id',
      as: 'department',
    },
  },
  { $unwind: '$department' },
  {
    $lookup: {
      from: 'exams',
      localField: 'candidate.examId',
      foreignField: '_id',
      as: 'exam',
    },
  },
  { $unwind: '$exam' },
];

// Escape ký tự đặc biệt regex trước khi đưa vào $regex — tránh regex injection
// từ input người dùng nhập ở ô tra cứu public.
function escapeRegex(str) {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const reportService = {
  async getOverviewStats() {
    const pipeline = [
      ...getBasePipeline(),
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
          failedCount: { $sum: { $cond: ['$passed', 0, 1] } },
          avgScore: { $avg: '$score' },
          uniqueCandidates: { $addToSet: '$employee._id' },
        },
      },
    ];

    const results = await Result.aggregate(pipeline);
    if (!results || results.length === 0) {
      return {
        totalSubmissions: 0,
        totalCandidates: 0,
        passedCount: 0,
        failedCount: 0,
        passRate: 0,
        avgScore: 0,
      };
    }

    const stats = results[0];
    const totalCandidates = stats.uniqueCandidates.length;
    const passRate = stats.totalSubmissions > 0
      ? (stats.passedCount / stats.totalSubmissions) * 100
      : 0;

    return {
      totalSubmissions: stats.totalSubmissions,
      totalCandidates,
      passedCount: stats.passedCount,
      failedCount: stats.failedCount,
      passRate: Number(passRate.toFixed(2)),
      avgScore: Number(stats.avgScore.toFixed(2)),
    };
  },

  async getResultsByDepartment() {
    const pipeline = [
      ...getBasePipeline(),
      {
        $group: {
          _id: '$department._id',
          departmentName: { $first: '$department.name' },
          totalSubmissions: { $sum: 1 },
          passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
          avgScore: { $avg: '$score' },
          uniqueCandidates: { $addToSet: '$employee._id' },
        },
      },
      {
        $project: {
          _id: 1,
          departmentName: 1,
          totalSubmissions: 1,
          totalCandidates: { $size: '$uniqueCandidates' },
          passedCount: 1,
          failedCount: { $subtract: ['$totalSubmissions', '$passedCount'] },
          passRate: {
            $cond: [
              { $gt: ['$totalSubmissions', 0] },
              { $multiply: [{ $divide: ['$passedCount', '$totalSubmissions'] }, 100] },
              0,
            ],
          },
          avgScore: 1,
        },
      },
      { $sort: { departmentName: 1 } },
    ];

    const results = await Result.aggregate(pipeline);
    return results.map(r => ({
      ...r,
      passRate: Number(r.passRate.toFixed(2)),
      avgScore: Number(r.avgScore.toFixed(2)),
    }));
  },

  /**
   * PUBLIC — dùng cho trang chủ (không đăng nhập). Chỉ trả về tên phòng ban +
   * tỷ lệ đạt (%) + tổng số lượt thi. KHÔNG trả passedCount/failedCount/avgScore
   * hay bất kỳ thông tin cá nhân nào — tuyệt đối không dùng lại nguyên hàm
   * getResultsByDepartment() ở trên cho route public vì nó lộ nhiều field hơn
   * mức cần thiết.
   */
  async getPublicResultsByDepartment() {
    const pipeline = [
      ...getBasePipeline(),
      {
        $group: {
          _id: '$department._id',
          departmentName: { $first: '$department.name' },
          totalSubmissions: { $sum: 1 },
          passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          departmentName: 1,
          totalSubmissions: 1,
          passRate: {
            $cond: [
              { $gt: ['$totalSubmissions', 0] },
              { $multiply: [{ $divide: ['$passedCount', '$totalSubmissions'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { passRate: -1 } },
    ];

    const results = await Result.aggregate(pipeline);
    return results.map(r => ({ ...r, passRate: Number(r.passRate.toFixed(2)) }));
  },

  /**
   * PUBLIC — tra cứu kết quả CÁ NHÂN theo mã nhân viên (khớp chính xác) hoặc họ
   * tên (khớp gần đúng, có thể trùng tên nhiều người → giới hạn 20 kết quả).
   * Chỉ trả về đúng các field cần hiển thị: tên, mã NV, phòng ban, điểm, kết
   * quả, thời gian nộp bài — KHÔNG trả examAttemptId, employee._id hay bất kỳ
   * field nội bộ nào khác.
   */
  async lookupPublicResult(term) {
    const q = String(term ?? '').trim();
    if (!q) return [];

    const escaped = escapeRegex(q);
    const pipeline = [
      ...getBasePipeline(),
      {
        $match: {
          $or: [
            { 'employee.employeeCode': { $regex: `^${escaped}$`, $options: 'i' } },
            { 'employee.fullname': { $regex: escaped, $options: 'i' } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
    ];

    const data = await Result.aggregate(pipeline);
    return data.map(item => ({
      fullname: item.employee.fullname,
      employeeCode: item.employee.employeeCode || null,
      departmentName: item.department.name,
      score: item.score,
      totalQuestions: item.totalQuestions,
      passed: item.passed,
      submittedAt: item.attempt.submittedAt,
    }));
  },

  async getDetailedResults(filters = {}) {
    const matchStage = {};
    if (filters.departmentId) {
      matchStage['department._id'] = new mongoose.Types.ObjectId(filters.departmentId);
    }
    if (filters.passed !== undefined && filters.passed !== '') {
      matchStage['passed'] = filters.passed === 'true';
    }
    if (filters.startDate || filters.endDate) {
      matchStage['createdAt'] = {};
      if (filters.startDate) matchStage['createdAt'].$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        matchStage['createdAt'].$lte = end;
      }
    }
    if (filters.search) {
      matchStage['employee.fullname'] = { $regex: filters.search, $options: 'i' };
    }

    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const pipeline = [
      ...getBasePipeline(),
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
    ];

    const [data, countResult] = await Promise.all([
      Result.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
      Result.aggregate([...pipeline, { $count: 'total' }]),
    ]);

    const total = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    const formattedData = data.map(item => ({
      _id: item._id,
      employeeName: item.employee.fullname,
      departmentName: item.department.name,
      examTitle: item.exam.title,
      score: item.score,
      passed: item.passed,
      submittedAt: item.attempt.submittedAt,
    }));

    return {
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async exportDetailedResultsExcel(filters = {}) {
    // Re-use logic but get all records
    const matchStage = {};
    if (filters.departmentId) {
      matchStage['department._id'] = new mongoose.Types.ObjectId(filters.departmentId);
    }
    if (filters.passed !== undefined && filters.passed !== '') {
      matchStage['passed'] = filters.passed === 'true';
    }
    if (filters.startDate || filters.endDate) {
      matchStage['createdAt'] = {};
      if (filters.startDate) matchStage['createdAt'].$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        matchStage['createdAt'].$lte = end;
      }
    }
    if (filters.search) {
      matchStage['employee.fullname'] = { $regex: filters.search, $options: 'i' };
    }

    const pipeline = [
      ...getBasePipeline(),
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
    ];

    const data = await Result.aggregate(pipeline);

    const worksheetData = data.map((item, index) => ({
      'STT': index + 1,
      'Họ và tên': item.employee.fullname,
      'Phòng ban': item.department.name,
      'Bài thi': item.exam.title,
      'Điểm': item.score,
      'Kết quả': item.passed ? 'Đạt' : 'Không đạt',
      'Ngày nộp': item.attempt.submittedAt ? new Date(item.attempt.submittedAt).toLocaleString('vi-VN') : '',
    }));

    const worksheet = xlsx.utils.json_to_sheet(worksheetData);

    // Auto-size columns
    const maxWidths = [5, 25, 20, 30, 10, 15, 20];
    worksheet['!cols'] = maxWidths.map(w => ({ wch: w }));

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Ket_qua_thi');

    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  },

  /**
   * MỚI — Lịch sử kết quả thi của chính thí sinh đang đăng nhập (role 'candidate').
   * Khác các hàm trên (dành cho leader/admin xem toàn hệ thống), hàm này chỉ trả
   * dữ liệu của đúng 1 employee gắn với userId hiện tại — match theo employee._id
   * ngay từ đầu pipeline để không lộ dữ liệu người khác.
   */
  async getMyResults(userId) {
    const employee = await Employee.findOne({ userId }).populate('departmentId').lean();

    if (!employee) {
      // Tài khoản chưa được gắn với hồ sơ nhân viên nào (vd tài khoản admin/examiner/leader
      // không có Employee tương ứng) — trả rỗng thay vì lỗi để FE tự xử lý hiển thị.
      return { employee: null, results: [] };
    }

    const pipeline = [
      ...getBasePipeline(),
      { $match: { 'employee._id': employee._id } },
      { $sort: { createdAt: -1 } },
    ];

    const data = await Result.aggregate(pipeline);

    const results = data.map((item) => ({
      _id: item._id,
      examId: item.exam._id,
      examTitle: item.exam.title,
      score: item.score,
      correctCount: item.correctCount,
      totalQuestions: item.totalQuestions,
      passed: item.passed,
      submittedAt: item.attempt.submittedAt,
      startedAt: item.attempt.startedAt,
    }));

    return {
      employee: {
        fullname: employee.fullname,
        employeeCode: employee.employeeCode || null,
        departmentName: employee.departmentId?.name || null,
      },
      results,
    };
  },
};