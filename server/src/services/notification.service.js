import { Notification, User, Role } from '../models/index.js';

function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('vi-VN');
}

export const notificationService = {
  async create({ recipientUserId, type, title, message, examId }) {
    return Notification.create({ recipientUserId, type, title, message, examId });
  },

  async createMany(recipientUserIds, { type, title, message, examId }) {
    if (!recipientUserIds?.length) return [];
    const docs = recipientUserIds.map((recipientUserId) => ({
      recipientUserId,
      type,
      title,
      message,
      examId,
    }));
    return Notification.insertMany(docs);
  },

  /**
   * Examiner gửi duyệt đề xuất -> báo cho MỌI user đang active có role
   * 'leader' (đề mới đang chờ duyệt). Không cần loại trừ ai vì người gửi
   * (Examiner) không thể đồng thời là Leader.
   */
  async notifyExamSubmitted(exam) {
    const leaderRole = await Role.findOne({ code: 'leader' }).select('_id').lean();
    if (!leaderRole?._id) return [];

    const leaders = await User.find({ isActive: true, roleId: leaderRole._id })
      .select('_id')
      .lean();
    const recipientIds = leaders.map((u) => u._id);

    return this.createMany(recipientIds, {
      type: 'exam_submitted',
      title: 'Có đề xuất kỳ thi mới chờ duyệt',
      message: `Kỳ thi "${exam.title}" vừa được gửi duyệt, đang chờ bạn phê duyệt hoặc từ chối.`,
      examId: exam._id,
    });
  },

  /** Leader phê duyệt đề xuất -> báo cho Examiner đã tạo đề xuất (exam.createdBy). */
  async notifyExamApproved(exam) {
    if (!exam?.createdBy) return null;
    return this.create({
      recipientUserId: exam.createdBy,
      type: 'exam_approved',
      title: 'Đề xuất kỳ thi đã được phê duyệt',
      message: `Kỳ thi "${exam.title}" đã được phê duyệt. Thời gian diễn ra: ${formatDateTime(exam.startDate)} - ${formatDateTime(exam.endDate)}.`,
      examId: exam._id,
    });
  },

  /** Leader từ chối đề xuất -> báo cho Examiner đã tạo đề xuất (exam.createdBy). */
  async notifyExamRejected(exam) {
    if (!exam?.createdBy) return null;
    return this.create({
      recipientUserId: exam.createdBy,
      type: 'exam_rejected',
      title: 'Đề xuất kỳ thi đã bị từ chối',
      message: `Kỳ thi "${exam.title}" đã bị từ chối. Lý do: ${exam.rejectionReason || 'Không có lý do'}.`,
      examId: exam._id,
    });
  },

  /**
   * Leader đăng chính thức kỳ thi -> báo cho MỌI user đang active, TRỪ:
   * - Chính người bấm đăng (publisherId)
   * - Mọi user có role 'admin'
   */
  async notifyExamPublished(exam, publisherId) {
    const adminRole = await Role.findOne({ code: 'admin' }).select('_id').lean();

    const query = { isActive: true, _id: { $ne: publisherId } };
    if (adminRole?._id) {
      query.roleId = { $ne: adminRole._id };
    }

    const recipients = await User.find(query).select('_id').lean();
    const recipientIds = recipients.map((u) => u._id);

    return this.createMany(recipientIds, {
      type: 'exam_published',
      title: 'Kỳ thi mới được đăng chính thức',
      message: `Kỳ thi "${exam.title}" đã được đăng chính thức. Thời gian: ${formatDateTime(exam.startDate)} - ${formatDateTime(exam.endDate)}.`,
      examId: exam._id,
    });
  },

  /**
   * Gán đề thi tự động cho 1 nhân viên mới THẤT BẠI (thường do ngân hàng câu
   * hỏi không đủ cho phòng ban của họ, kể cả sau khi đã bù từ pool câu
   * chung — xem validateQuestionAvailability() trong
   * exam-code-generation.service.js) -> báo cho Examiner đã tạo kỳ thi VÀ
   * MỌI Admin đang active, để họ chủ động bổ sung câu hỏi cho phòng ban đó.
   * Không có bước này thì nhân viên sẽ âm thầm không có đề để thi mà không
   * ai biết, cho tới khi chính họ phàn nàn không thi được.
   */
  async notifyExamAssignmentFailed({ exam, employee, department, reason }) {
    const adminRole = await Role.findOne({ code: 'admin' }).select('_id').lean();
    const admins = adminRole?._id
      ? await User.find({ isActive: true, roleId: adminRole._id }).select('_id').lean()
      : [];

    const recipientIds = admins.map((u) => u._id);
    if (exam.createdBy) {
      const createdByStr = exam.createdBy.toString();
      if (!recipientIds.some((id) => id.toString() === createdByStr)) {
        recipientIds.push(exam.createdBy);
      }
    }
    if (recipientIds.length === 0) return [];

    const employeeLabel = employee?.fullname || employee?.employeeCode || 'Nhân viên mới';
    const departmentLabel = department?.name || 'phòng ban của nhân viên này';

    return this.createMany(recipientIds, {
      type: 'exam_assignment_failed',
      title: 'Có thí sinh chưa được phát đề thi',
      message: `Thí sinh "${employeeLabel}" (phòng ban "${departmentLabel}") chưa được phát đề cho kỳ thi "${exam.title}" do ngân hàng câu hỏi không đủ số lượng${reason ? ` (${reason})` : ''}. Vui lòng import/bổ sung thêm câu hỏi cho phòng ban này để hệ thống tự động gán đề.`,
      examId: exam._id,
    });
  },

  async listForUser(userId, { limit = 30 } = {}) {
    return Notification.find({ recipientUserId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('examId', 'title')
      .lean();
  },

  async countUnread(userId) {
    return Notification.countDocuments({ recipientUserId: userId, isRead: false });
  },

  async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, recipientUserId: userId },
      { $set: { isRead: true } },
      { new: true },
    ).lean();
  },

  async markAllAsRead(userId) {
    await Notification.updateMany(
      { recipientUserId: userId, isRead: false },
      { $set: { isRead: true } },
    );
  },
};