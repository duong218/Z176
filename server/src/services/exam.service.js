/**
 * Service Quản lý Kỳ thi (Exam Service).
 * Xử lý các nghiệp vụ: Đề xuất kỳ thi, Gửi duyệt, Phê duyệt/Từ chối, Xuất bản kỳ thi (Publish) và Lưu trữ (Archive).
 */

import { Exam, Topic } from '../models/index.js';
import { EXAM_STATUS } from '../models/constants.js';
import { ApiError } from '../utils/api-error.js';
import { generateExamCodesAndAssignCandidates } from './exam-code-generation.service.js';
import { notificationService } from './notification.service.js';

// Khóa phát hành quá hạn (server sập giữa chừng) được coi là đã gỡ.
const PUBLISH_LOCK_TTL_MS = 10 * 60 * 1000;

function publishLockFree() {
  return {
    $or: [
      { publishLockedAt: { $exists: false } },
      { publishLockedAt: null },
      { publishLockedAt: { $lt: new Date(Date.now() - PUBLISH_LOCK_TTL_MS) } },
    ],
  };
}

// findOneAndUpdate không khớp: phân biệt "không tồn tại" (404) với "đã bị người khác xử lý" (409).
async function buildTransitionError(examId, expectedStatuses, message) {
  const current = await Exam.findById(examId).select('status').lean();
  if (!current) return new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');
  if (expectedStatuses.includes(current.status)) {
    return new ApiError(
      409,
      'Kỳ thi vừa được thay đổi ở nơi khác. Vui lòng tải lại danh sách rồi thử lại.',
      'EXAM_CONFLICT',
    );
  }
  return new ApiError(400, message, 'EXAM_INVALID_STATUS');
}

// Bước cuối của phát hành: lưu trữ kỳ thi published cũ rồi đặt kỳ thi này thành published.
// Index duy nhất 'uniq_single_published_exam' đảm bảo không bao giờ có 2 kỳ thi published; nếu 2 kỳ thi khác nhau
// được đăng sát nhau thì kỳ thi sau lưu trữ kỳ thi trước ("đăng mới đè đăng cũ") và thử lại.
async function finalizePublish(examId, lockToken) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await Exam.updateMany(
      { status: EXAM_STATUS.PUBLISHED, _id: { $ne: examId } },
      { $set: { status: EXAM_STATUS.ARCHIVED }, $inc: { __v: 1 } },
    );
    try {
      const published = await Exam.findOneAndUpdate(
        { _id: examId, status: EXAM_STATUS.APPROVED, publishLockedAt: lockToken },
        {
          $set: { status: EXAM_STATUS.PUBLISHED, publishedAt: new Date() },
          $unset: { publishLockedAt: 1 },
          $inc: { __v: 1 },
        },
        { new: true },
      );
      if (!published) {
        throw await buildTransitionError(examId, [EXAM_STATUS.APPROVED], 'Kỳ thi không còn ở trạng thái chờ phát hành');
      }
      return published;
    } catch (err) {
      if (err?.code === 11000) continue; // vừa có kỳ thi khác được đăng -> lưu trữ nó rồi thử lại
      throw err;
    }
  }
  throw new ApiError(
    409,
    'Đang có kỳ thi khác được đăng chính thức cùng lúc. Vui lòng tải lại danh sách rồi thử lại.',
    'EXAM_PUBLISH_CONFLICT',
  );
}

export const examService = {
  // Lấy danh sách kỳ thi theo bộ lọc (trạng thái, người tạo, chủ đề)
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

  // Examiner tạo bản thảo đề xuất kỳ thi mới (DRAFT)
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

  // MỚI — Examiner sửa lại đề xuất của chính mình (áp dụng cho đề đang ở
  // trạng thái draft hoặc rejected — cùng điều kiện với submitExamForReview).
  // Sau khi sửa, đề TỰ ĐỘNG quay về draft (kể cả khi đang rejected) và xoá
  // rejectionReason cũ — vì nội dung đã đổi, lý do từ chối trước đó không
  // còn phản ánh đúng đề hiện tại nữa. Examiner cần bấm "Gửi duyệt" lại như
  // bình thường sau khi sửa, KHÔNG tự động gửi duyệt ngay trong hàm này —
  // để họ có cơ hội xem lại lần cuối trước khi gửi.
  async updateExamProposal(examId, payload, userId) {
    const exam = await Exam.findOne({ _id: examId, createdBy: userId });
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');

    if (![EXAM_STATUS.DRAFT, EXAM_STATUS.REJECTED].includes(exam.status)) {
      throw new ApiError(400, 'Kỳ thi không ở trạng thái hợp lệ để chỉnh sửa', 'EXAM_INVALID_STATUS');
    }

    const { title, topicId, durationMinutes, totalQuestions, commonQuestionCount, departmentQuestionCount, passThresholdPercent } = payload;

    if (topicId && String(topicId) !== String(exam.topicId)) {
      const topic = await Topic.findById(topicId);
      if (!topic) throw new ApiError(404, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');
    }

    exam.title = title;
    exam.topicId = topicId;
    exam.durationMinutes = durationMinutes;
    exam.totalQuestions = totalQuestions;
    exam.commonQuestionCount = commonQuestionCount;
    exam.departmentQuestionCount = departmentQuestionCount;
    exam.passThresholdPercent = passThresholdPercent;
    exam.status = EXAM_STATUS.DRAFT;
    exam.rejectionReason = undefined;

    try {
      await exam.save();
    } catch (err) {
      // Đề vừa bị thao tác khác thay đổi (vd gửi duyệt từ tab khác) trong lúc đang sửa -> không ghi đè lặng lẽ.
      if (err?.name === 'VersionError') {
        throw new ApiError(
          409,
          'Đề xuất vừa được thay đổi ở nơi khác (có thể đã được gửi duyệt từ tab hoặc thiết bị khác). Vui lòng tải lại danh sách rồi thử lại.',
          'EXAM_CONFLICT',
        );
      }
      throw err;
    }
    return exam;
  },

  // Examiner gửi duyệt đề xuất kỳ thi -> Chuyển trạng thái sang PENDING_REVIEW và bắn thông báo tới Leader
  async submitExamForReview(examId, userId) {
    const exam = await Exam.findOne({ _id: examId, createdBy: userId });
    if (!exam) throw new ApiError(404, 'Không tìm thấy kỳ thi', 'EXAM_NOT_FOUND');

    if (![EXAM_STATUS.DRAFT, EXAM_STATUS.REJECTED].includes(exam.status)) {
      throw new ApiError(400, 'Kỳ thi không ở trạng thái hợp lệ để gửi duyệt', 'EXAM_INVALID_STATUS');
    }

    // Nguyên tử: chỉ chuyển được khi đề VẪN ở draft/rejected và CHƯA bị sửa kể từ lúc đọc (khớp __v).
    // Hai lần nộp đồng thời (double-click) -> chỉ 1 lần thắng, không tạo thông báo trùng cho Leader.
    const submitted = await Exam.findOneAndUpdate(
      {
        _id: exam._id,
        createdBy: userId,
        status: { $in: [EXAM_STATUS.DRAFT, EXAM_STATUS.REJECTED] },
        __v: exam.__v,
      },
      { $set: { status: EXAM_STATUS.PENDING_REVIEW }, $inc: { __v: 1 } },
      { new: true },
    );
    if (!submitted) {
      throw await buildTransitionError(
        exam._id,
        [EXAM_STATUS.DRAFT, EXAM_STATUS.REJECTED],
        'Kỳ thi không ở trạng thái hợp lệ để gửi duyệt',
      );
    }

    try {
      await notificationService.notifyExamSubmitted(submitted);
    } catch (err) {
      console.error('notifyExamSubmitted failed:', err);
    }

    return submitted;
  },

  // Leader phê duyệt kỳ thi (APPROVED) và ấn định khung thời gian thi
  async approveExam(examId, { startDate, endDate }, leaderId) {
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Vui lòng cung cấp ngày bắt đầu và kết thúc', 'EXAM_DATES_REQUIRED');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      throw new ApiError(400, 'Ngày kết thúc phải sau ngày bắt đầu', 'EXAM_DATES_INVALID');
    }

    // Nguyên tử: chỉ 1 Người duyệt đề thắng khi nhiều người cùng bấm; người đến sau nhận lỗi, không ghi đè, không thông báo trùng.
    const exam = await Exam.findOneAndUpdate(
      { _id: examId, status: EXAM_STATUS.PENDING_REVIEW },
      {
        $set: {
          status: EXAM_STATUS.APPROVED,
          startDate: start,
          endDate: end,
          approvedBy: leaderId,
          approvedAt: new Date(),
        },
        $inc: { __v: 1 },
      },
      { new: true },
    );
    if (!exam) {
      throw await buildTransitionError(examId, [EXAM_STATUS.PENDING_REVIEW], 'Kỳ thi không ở trạng thái chờ duyệt');
    }

    try {
      await notificationService.notifyExamApproved(exam);
    } catch (err) {
      console.error('notifyExamApproved failed:', err);
    }

    return exam;
  },

  // Leader từ chối đề xuất kỳ thi (REJECTED) kèm lý do
  async rejectExam(examId, rejectionReason, leaderId) {
    if (!rejectionReason?.trim()) {
      throw new ApiError(400, 'Vui lòng cung cấp lý do từ chối', 'REASON_REQUIRED');
    }

    const exam = await Exam.findOneAndUpdate(
      { _id: examId, status: EXAM_STATUS.PENDING_REVIEW },
      {
        $set: { status: EXAM_STATUS.REJECTED, rejectionReason: rejectionReason.trim(), approvedBy: leaderId },
        $inc: { __v: 1 },
      },
      { new: true },
    );
    if (!exam) {
      throw await buildTransitionError(examId, [EXAM_STATUS.PENDING_REVIEW], 'Kỳ thi không ở trạng thái chờ duyệt');
    }

    try {
      await notificationService.notifyExamRejected(exam);
    } catch (err) {
      console.error('notifyExamRejected failed:', err);
    }

    return exam;
  },

  // Công bố kỳ thi chính thức (PUBLISHED): Sinh các bộ mã đề thi, gán thí sinh và lưu trữ kỳ thi cũ
  async publishExam(examId, leaderId) {
    // Chiếm khóa phát hành nguyên tử: 2 người cùng đăng 1 đề -> chỉ 1 người vào được; Lưu trữ cũng bị chặn trong lúc này.
    const lockToken = new Date();
    const claimed = await Exam.findOneAndUpdate(
      { _id: examId, status: EXAM_STATUS.APPROVED, ...publishLockFree() },
      { $set: { publishLockedAt: lockToken }, $inc: { __v: 1 } },
      { new: true },
    );
    if (!claimed) {
      throw await buildTransitionError(examId, [EXAM_STATUS.APPROVED], 'Chỉ có thể phát hành kỳ thi đã được duyệt');
    }

    let published;
    try {
      // Sinh mã đề và gán thí sinh (idempotent theo từng nhân viên)
      await generateExamCodesAndAssignCandidates(claimed);
      // Lưu trữ kỳ thi published cũ rồi đặt kỳ thi này thành published (có index chặn trùng)
      published = await finalizePublish(claimed._id, lockToken);
    } catch (err) {
      // Lỗi -> gỡ khóa để Người duyệt đề thử lại được ngay
      await Exam.updateOne(
        { _id: claimed._id, publishLockedAt: lockToken },
        { $unset: { publishLockedAt: 1 } },
      ).catch((releaseErr) => console.error('release publish lock failed:', releaseErr));
      throw err;
    }

    try {
      await notificationService.notifyExamPublished(published, leaderId);
    } catch (err) {
      console.error('notifyExamPublished failed:', err);
    }

    return published;
  },

  // Lưu trữ (ARCHIVE) một kỳ thi đã duyệt mà Leader quyết định không xuất bản nữa
  async archiveExam(examId, leaderId) {
    // Nguyên tử + không được chen ngang khi đề đang được một Người duyệt đề khác phát hành.
    const exam = await Exam.findOneAndUpdate(
      { _id: examId, status: EXAM_STATUS.APPROVED, ...publishLockFree() },
      { $set: { status: EXAM_STATUS.ARCHIVED, approvedBy: leaderId }, $inc: { __v: 1 } },
      { new: true },
    );
    if (!exam) {
      throw await buildTransitionError(
        examId,
        [EXAM_STATUS.APPROVED],
        'Chỉ có thể bỏ qua kỳ thi đang ở trạng thái chờ phát hành',
      );
    }
    return exam;
  },

  // Lấy kỳ thi đang phát hành chính thức hiện tại
  async getActiveExam() {
    const exam = await Exam.findOne({ status: EXAM_STATUS.PUBLISHED })
      .populate('topicId', 'name')
      .lean();
    return exam;
  },
};