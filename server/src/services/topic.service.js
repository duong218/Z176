import { Topic, Question, Exam, EXAM_STATUS } from '../models/index.js';
import { ApiError, assertFound } from '../utils/api-error.js';

export async function listTopics({ activeOnly = true } = {}) {
  const filter = activeOnly ? { isActive: true } : {};
  return Topic.find(filter).sort({ name: 1 }).lean();
}

// Escape ký tự đặc biệt trong regex (dùng chung cho tìm kiếm không phân
// biệt hoa/thường bên dưới).
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tạo chủ đề mới. Nếu tên trùng với 1 chủ đề ĐÃ BỊ XOÁ MỀM (isActive:false)
 * thì KHÔI PHỤC LẠI chủ đề đó (kèm mô tả mới) thay vì báo lỗi trùng —
 * người dùng bấm Xóa trên giao diện thì hiểu là xóa hẳn, không biết đây là
 * xóa mềm, nên báo lỗi "đã tồn tại" ở đây rất khó hiểu.
 * Trả về thêm `restored: true` khi rơi vào nhánh khôi phục, để nơi gọi (vd
 * toast ở TopicTab) hiển thị đúng thông báo "đã khôi phục chủ đề cũ (bao
 * gồm các câu hỏi cũ thuộc chủ đề này)" thay vì "tạo chủ đề mới" — tránh gây
 * bất ngờ khi chủ đề "mới tạo" lại có sẵn câu hỏi.
 */
export async function createTopic({ name, description }) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Tên chủ đề là bắt buộc', 'TOPIC_VALIDATION');
  }

  const inactiveMatch = await Topic.findOne({
    name: { $regex: `^${escapeRegExp(trimmed)}$`, $options: 'i' },
    isActive: false,
  });
  if (inactiveMatch) {
    inactiveMatch.isActive = true;
    inactiveMatch.name = trimmed;
    if (description !== undefined) inactiveMatch.description = description?.trim() || '';
    await inactiveMatch.save();
    return { ...inactiveMatch.toObject(), restored: true };
  }

  try {
    const doc = await Topic.create({ name: trimmed, description: description?.trim() });
    return { ...doc.toObject(), restored: false };
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Chủ đề đã tồn tại', 'TOPIC_DUPLICATE');
    }
    throw err;
  }
}

export async function updateTopic(id, { name, description, isActive } = {}) {
  const topic = await Topic.findById(id);
  assertFound(topic, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');

  if (name !== undefined) {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new ApiError(400, 'Tên chủ đề là bắt buộc', 'TOPIC_VALIDATION');
    }
    topic.name = trimmed;
  }
  if (description !== undefined) topic.description = description?.trim() || '';
  if (isActive !== undefined) topic.isActive = Boolean(isActive);

  try {
    await topic.save();
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Chủ đề đã tồn tại', 'TOPIC_DUPLICATE');
    }
    throw err;
  }
  return topic.toObject();
}

// Xóa mềm: chỉ tắt isActive, KHÔNG xóa hẳn khỏi DB, vì Question đang tham
// chiếu topicId tới chủ đề này (giống lý do áp dụng cho Department).
//
// CHẶN nếu đang có 1 kỳ thi ở trạng thái PUBLISHED (đang diễn ra) dùng
// chính chủ đề này (Exam.topicId). Lý do: hệ thống chỉ cho phép TỐI ĐA 1
// kỳ thi published tại 1 thời điểm (mỗi lần publishExam() sẽ archive kỳ
// thi published trước đó — xem exam.service.js). Nếu vẫn cho ngừng sử dụng
// chủ đề trong lúc kỳ thi đang chạy: thí sinh ĐÃ được gán đề từ trước
// (ExamCode/ExamCodeQuestion/AttemptQuestion đã snapshot cố định questionId)
// KHÔNG bị ảnh hưởng — nhưng nếu có NHÂN VIÊN MỚI được thêm vào 1 phòng ban
// CHƯA từng có ExamCode (vd phòng ban đó lúc publish chưa có ai),
// generateExamCodesAndAssignCandidates() sẽ thử tạo ExamCode mới cho phòng
// ban đó và query lại Question với isActive:true — lúc này toàn bộ câu hỏi
// của chủ đề đã bị cascade tắt (isActive:false) nên không đủ câu hỏi, ném
// lỗi INSUFFICIENT_QUESTIONS. Lỗi đó lại bị NUỐT LẶNG LẼ trong
// assignEmployeeToActiveExamIfAny() (chỉ console.error, không báo ai) —
// nhân viên mới đó sẽ VĨNH VIỄN không được gán đề, không thể thi, mà không
// ai biết. Chặn hẳn ở đây (thay vì vá từng điểm gọi lại) là cách an toàn
// nhất: đơn giản, chặn đúng gốc, không bỏ sót đường gọi nào khác.
export async function deactivateTopic(id) {
  const topic = await Topic.findById(id);
  assertFound(topic, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');

  const activeExam = await Exam.findOne({ topicId: topic._id, status: EXAM_STATUS.PUBLISHED });
  if (activeExam) {
    throw new ApiError(
      409,
      `Không thể ngừng sử dụng chủ đề "${topic.name}" vì chủ đề này đang được dùng cho kỳ thi "${activeExam.title}" đang diễn ra. Vui lòng đợi kỳ thi kết thúc rồi thử lại.`,
      'TOPIC_HAS_ACTIVE_EXAM',
    );
  }

  topic.isActive = false;
  await topic.save();

  await Question.updateMany({ topicId: topic._id, isActive: true }, { isActive: false });

  return { id: topic._id.toString(), isActive: false };
}

export async function findOrCreateTopicByName(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Tên chủ đề là bắt buộc', 'TOPIC_VALIDATION');
  }
  // So khớp KHÔNG phân biệt hoa/thường khi tìm chủ đề đã có (giống cách đã
  // sửa cho findDepartmentByName) — trước đây dùng exact match nên chỉ cần
  // lệch hoa/thường lúc import Excel là tạo ra chủ đề trùng lặp (VD "An toan
  // lao dong" và "An toàn lao động" bị coi là 2 chủ đề khác nhau), khiến số
  // câu hỏi bị rải ra nhiều topicId thay vì gộp đúng 1 chủ đề.
  let topic = await Topic.findOne({
    name: { $regex: `^${escapeRegExp(trimmed)}$`, $options: 'i' },
  });
  if (!topic) {
    topic = await Topic.create({ name: trimmed });
  } else if (!topic.isActive) {
    // Trùng tên với 1 chủ đề ĐÃ BỊ XOÁ MỀM — query ở trên KHÔNG lọc isActive
    // nên vẫn khớp trúng chủ đề cũ và gắn topicId của nó vào câu hỏi vừa
    // import, nhưng nếu không bật lại isActive thì chủ đề đó vẫn "vô hình"
    // với mọi nơi hiển thị (dropdown chọn chủ đề, tạo đề xuất kỳ thi...) vì
    // các chỗ đó đều gọi listTopics({ activeOnly: true }). Khôi phục lại
    // luôn để câu hỏi vừa import có chủ đề dùng được ngay.
    topic.isActive = true;
    await topic.save();
  }
  return topic;
}

export async function getTopicById(id) {
  const topic = await Topic.findById(id);
  assertFound(topic, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');
  return topic;
}