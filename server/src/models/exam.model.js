import mongoose from 'mongoose';
import { EXAM_STATUS } from './constants.js';

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
      index: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    durationMinutes: { type: Number, required: true, min: 1 },
    totalQuestions: { type: Number, required: true, min: 1 },
    commonQuestionCount: { type: Number, required: true, min: 0 },
    departmentQuestionCount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(EXAM_STATUS),
      default: EXAM_STATUS.DRAFT,
      index: true,
    },
    /**
     * Assumption nhóm nghiên cứu (BRS Bước 7 #1) — % câu đúng tối thiểu để đạt.
     * Cấu hình theo kỳ thi trên Exam, không đặt trong env.
     */
    passThresholdPercent: { type: Number, min: 0, max: 100, default: 70 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    publishedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    /**
     * Khóa "đang phát hành": đặt nguyên tử khi một Người duyệt đề bắt đầu publishExam, gỡ khi phát hành xong hoặc lỗi.
     * Chặn 2 người cùng đăng một kỳ thi (sinh trùng mã đề) và chặn Lưu trữ chen ngang lúc đang phát hành.
     * Khóa quá hạn (PUBLISH_LOCK_TTL_MS trong exam.service.js) coi như đã hết hiệu lực, phòng khi server sập giữa chừng.
     */
    publishLockedAt: { type: Date },
  },
  // optimisticConcurrency: save() kèm điều kiện __v; đề đã bị thao tác khác sửa/chuyển trạng thái trong lúc đang xử lý
  // thì ném VersionError thay vì ghi đè lặng lẽ. Mọi cập nhật nguyên tử trong exam.service.js đều $inc __v để khớp.
  { timestamps: true, optimisticConcurrency: true },
);

// Tối đa MỘT kỳ thi ở trạng thái published tại mọi thời điểm (chốt chặn ở tầng DB).
// LƯU Ý: nếu DB hiện có >1 kỳ thi published thì Mongo không tạo được index này (app vẫn chạy, chỉ log lỗi)
// -> lưu trữ bớt cho còn 1 đề published rồi khởi động lại server.
examSchema.index(
  { status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: EXAM_STATUS.PUBLISHED },
    name: 'uniq_single_published_exam',
  },
);

examSchema.pre('validate', function validateQuestionCounts(next) {
  const sum = (this.commonQuestionCount ?? 0) + (this.departmentQuestionCount ?? 0);
  if (this.totalQuestions != null && sum !== this.totalQuestions) {
    next(
      new Error(
        'commonQuestionCount + departmentQuestionCount must equal totalQuestions',
      ),
    );
    return;
  }
  next();
});

export const Exam = mongoose.model('Exam', examSchema);