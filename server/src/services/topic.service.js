import { Topic } from '../models/index.js';
import { ApiError, assertFound } from '../utils/api-error.js';

export async function listTopics({ activeOnly = true } = {}) {
  const filter = activeOnly ? { isActive: true } : {};
  return Topic.find(filter).sort({ name: 1 }).lean();
}

export async function createTopic({ name, description }) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Tên chủ đề là bắt buộc', 'TOPIC_VALIDATION');
  }
  try {
    const doc = await Topic.create({ name: trimmed, description: description?.trim() });
    return doc.toObject();
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
export async function deactivateTopic(id) {
  const topic = await Topic.findById(id);
  assertFound(topic, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');
  topic.isActive = false;
  await topic.save();
  return { id: topic._id.toString(), isActive: false };
}

// Escape ký tự đặc biệt trong regex để tránh lỗi hoặc khớp sai khi tên chủ
// đề chứa các ký tự như . ( ) + * ? [ ] ^ $ | \
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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