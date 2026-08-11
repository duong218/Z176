import * as topicService from '../services/topic.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';
import { writeAudit } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const activeOnly = req.query.activeOnly !== 'false';
  const data = await topicService.listTopics({ activeOnly });
  res.json({ success: true, message: 'OK', code: 'TOPIC_LIST_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body ?? {};
  const data = await topicService.createTopic({ name, description });

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'CREATE_TOPIC',
    resourceType: 'Topic',
    resourceId: data._id,
    metadata: { detail: `Tạo chủ đề mới: ${name}` },
    ipAddress: req.ip,
  });
  res.status(201).json({
    success: true,
    message: 'Tạo chủ đề thành công',
    code: 'TOPIC_CREATED',
    data,
  });
});
