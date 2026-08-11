import * as topicService from '../services/topic.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';

export const list = asyncHandler(async (req, res) => {
  const activeOnly = req.query.activeOnly !== 'false';
  const data = await topicService.listTopics({ activeOnly });
  res.json({ success: true, message: 'OK', code: 'TOPIC_LIST_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body ?? {};
  const data = await topicService.createTopic({ name, description });
  res.status(201).json({
    success: true,
    message: 'Tạo chủ đề thành công',
    code: 'TOPIC_CREATED',
    data,
  });
});
