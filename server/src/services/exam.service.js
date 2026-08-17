import { Exam, Topic } from '../models/index.js';
import { EXAM_STATUS } from '../models/constants.js';
import { ApiError } from '../utils/api-error.js';
import { generateExamCodesAndAssignCandidates } from './exam-code-generation.service.js';
import { notificationService } from './notification.service.js';

export const examService = {
  async listExams(filters = {}) {
    const { status, createdBy, topicId } = filters;
    const query = {};
    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;
    if (topicId) query.topicId = topicId;

    const exams = await Exam.find(query)
      .populate('topicId', 'name')
      .populate('createdBy', 'username fullName')
      .populate('approvedBy', 'username fullName')
      .sort({ createdAt: -1 })
      .lean();

    return exams;
  },

  async createExamProposal(payload, userId) {
    const { title, topicId, durationMinutes, totalQuestions, commonQuestionCount, departmentQuestionCount, passThresholdPercent } = payload;

    const topic = await Topic.findById(topicId);
    if (!topic) throw new ApiError(404, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');

    const exam = new Exam({
      title,
      topicId,
      durationMinutes,
      totalQuestions,
      commonQuestionCount,
      departmentQuestionCount,
      passThresholdPercent,
      createdBy: userId,
      status: EXAM_STATUS.DRAFT,
    });
    await exam.save();
    return exam;
  },

  async submitExamForReview(examId, userId) {
    const exam = await Exam.findOne({ _id: examId, createdBy: userId });
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');

    if (![EXAM_STATUS.DRAFT, EXAM_STATUS.REJECTED].includes(exam.status)) {
      throw new ApiError(400, 'Kỳ thi không ở trạng thái hợp lệ để gửi duyệt', 'EXAM_INVALID_STATUS');
    }

    exam.status = EXAM_STATUS.PENDING_REVIEW;
    await exam.save();

    // Báo cho mọi Leader biết có đề mới đang chờ duyệt.
    try {
      await notificationService.notifyExamSubmitted(exam);
    } catch (err) {
      console.error('notifyExamSubmitted failed:', err);
    }

    return exam;
  },

  async approveExam(examId, { startDate, endDate }, leaderId) {
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Vui lòng cung cấp ngày bắt đầu và kết thúc', 'EXAM_DATES_REQUIRED');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      throw new ApiError(400, 'Ngày kết thúc phải sau ngày bắt đầu', 'EXAM_DATES_INVALID');
    }

    const exam = await Exam.findById(examId);
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');
    if (exam.status !== EXAM_STATUS.PENDING_REVIEW) {
      throw new ApiError(400, 'Kỳ thi không ở trạng thái chờ duyệt', 'EXAM_INVALID_STATUS');
    }

    exam.status = EXAM_STATUS.APPROVED;
    exam.startDate = start;
    exam.endDate = end;
    exam.approvedBy = leaderId;
    exam.approvedAt = new Date();
    await exam.save();

    // Báo cho Examiner đã tạo đề xuất rằng đề của họ đã được duyệt. Không để
    // lỗi tạo thông báo (vd DB tạm thời lag) làm hỏng luồng duyệt đề chính —
    // duyệt đề đã ghi nhận thành công ở trên rồi.
    try {
      await notificationService.notifyExamApproved(exam);
    } catch (err) {
      console.error('notifyExamApproved failed:', err);
    }

    return exam;
  },

  async rejectExam(examId, rejectionReason, leaderId) {
    if (!rejectionReason?.trim()) {
      throw new ApiError(400, 'Vui lòng cung cấp lý do từ chối', 'REASON_REQUIRED');
    }

    const exam = await Exam.findById(examId);
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');
    if (exam.status !== EXAM_STATUS.PENDING_REVIEW) {
      throw new ApiError(400, 'Kỳ thi không ở trạng thái chờ duyệt', 'EXAM_INVALID_STATUS');
    }

    exam.status = EXAM_STATUS.REJECTED;
    exam.rejectionReason = rejectionReason;
    exam.approvedBy = leaderId; // record who rejected it
    await exam.save();

    // Báo cho Examiner đã tạo đề xuất rằng đề của họ bị từ chối (kèm lý do).
    try {
      await notificationService.notifyExamRejected(exam);
    } catch (err) {
      console.error('notifyExamRejected failed:', err);
    }

    return exam;
  },

  async publishExam(examId, leaderId) {
    const exam = await Exam.findById(examId);
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');
    if (exam.status !== EXAM_STATUS.APPROVED) {
      throw new ApiError(400, 'Chỉ có thể phát hành kỳ thi đã được duyệt', 'EXAM_INVALID_STATUS');
    }

    // Sinh mã đề theo phòng ban + gán thí sinh TRƯỚC khi đổi trạng thái —
    // nếu ngân hàng câu hỏi không đủ, lỗi sẽ chặn ở đây và kỳ thi vẫn giữ
    // nguyên trạng thái 'approved', tránh publish dở dang.
    await generateExamCodesAndAssignCandidates(exam);

    // Archive any currently published exam
    await Exam.updateMany(
      { status: EXAM_STATUS.PUBLISHED },
      { $set: { status: EXAM_STATUS.ARCHIVED } }
    );

    exam.status = EXAM_STATUS.PUBLISHED;
    exam.publishedAt = new Date();
    await exam.save();

    // Báo cho MỌI role, TRỪ chính người bấm đăng (leaderId) và role 'admin'.
    try {
      await notificationService.notifyExamPublished(exam, leaderId);
    } catch (err) {
      console.error('notifyExamPublished failed:', err);
    }

    return exam;
  },

  /**
   * "Bỏ qua" một kỳ thi đã duyệt (approved) đang chờ phát hành: lưu trữ nó
   * mà không đăng chính thức. Khác với reject (chỉ áp dụng cho kỳ thi đang
   * pending_review) — đây là kỳ thi ĐÃ được duyệt nhưng Leader quyết định
   * không phát hành nữa.
   */
  async archiveExam(examId, leaderId) {
    const exam = await Exam.findById(examId);
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');
    if (exam.status !== EXAM_STATUS.APPROVED) {
      throw new ApiError(400, 'Chỉ có thể bỏ qua kỳ thi đang ở trạng thái chờ phát hành', 'EXAM_INVALID_STATUS');
    }

    exam.status = EXAM_STATUS.ARCHIVED;
    exam.approvedBy = leaderId;
    await exam.save();
    return exam;
  },

  async getActiveExam() {
    const exam = await Exam.findOne({ status: EXAM_STATUS.PUBLISHED })
      .populate('topicId', 'name')
      .lean();
    return exam;
  },
};