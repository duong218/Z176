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

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive } = req.body ?? {};
  const data = await topicService.updateTopic(id, { name, description, isActive });

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'UPDATE_TOPIC',
    resourceType: 'Topic',
    resourceId: data._id ?? id,
    metadata: { detail: `Cập nhật chủ đề: ${data.name}` },
    ipAddress: req.ip,
  });
  res.json({
    success: true,
    message: 'Cập nhật chủ đề thành công',
    code: 'TOPIC_UPDATED',
    data,
  });
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await topicService.deactivateTopic(id);

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'DEACTIVATE_TOPIC',
    resourceType: 'Topic',
    resourceId: id,
    metadata: { detail: `Ngừng sử dụng chủ đề: ${id}` },
    ipAddress: req.ip,
  });
  res.json({
    success: true,
    message: 'Đã ngừng sử dụng chủ đề',
    code: 'TOPIC_DEACTIVATED',
    data,
  });
});