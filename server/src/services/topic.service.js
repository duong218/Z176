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

export async function findOrCreateTopicByName(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Tên chủ đề là bắt buộc', 'TOPIC_VALIDATION');
  }
  let topic = await Topic.findOne({ name: trimmed });
  if (!topic) {
    topic = await Topic.create({ name: trimmed });
  }
  return topic;
}

export async function getTopicById(id) {
  const topic = await Topic.findById(id);
  assertFound(topic, 'Không tìm thấy chủ đề', 'TOPIC_NOT_FOUND');
  return topic;
}
