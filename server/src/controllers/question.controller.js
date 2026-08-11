import * as questionService from '../services/question.service.js';
import { writeAudit } from '../services/audit.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';
import {
  ANSWER_TYPE,
  DIFFICULTY,
  QUESTION_KIND,
  QUESTION_SCOPE,
} from '../models/constants.js';

function clientIp(req) {
  return req.ip ?? req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim();
}

function parseCreateBody(body) {
  const {
    content,
    questionKind,
    answerType,
    difficulty,
    scope,
    topicId,
    departmentId,
    imageUrl,
    answers,
  } = body ?? {};

  const enums = [
    [questionKind, Object.values(QUESTION_KIND), 'questionKind'],
    [answerType, Object.values(ANSWER_TYPE), 'answerType'],
    [difficulty, Object.values(DIFFICULTY), 'difficulty'],
    [scope, Object.values(QUESTION_SCOPE), 'scope'],
  ];
  for (const [val, allowed, label] of enums) {
    if (!allowed.includes(val)) {
      throw new ApiError(400, `${label} không hợp lệ`, 'QUESTION_VALIDATION');
    }
  }

  return {
    content,
    questionKind,
    answerType,
    difficulty,
    scope,
    topicId,
    departmentId,
    imageUrl,
    answers,
  };
}

export const list = asyncHandler(async (req, res) => {
  const data = await questionService.listQuestions({
    topicId: req.query.topicId,
    scope: req.query.scope,
    departmentId: req.query.departmentId,
    questionKind: req.query.questionKind,
    difficulty: req.query.difficulty,
    answerType: req.query.answerType,
    isActive: req.query.isActive ?? true,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ success: true, message: 'OK', code: 'QUESTION_LIST_OK', data });
});

export const getById = asyncHandler(async (req, res) => {
  const data = await questionService.getQuestionById(req.params.id);
  res.json({ success: true, message: 'OK', code: 'QUESTION_GET_OK', data });
});

export const create = asyncHandler(async (req, res) => {
  const payload = parseCreateBody(req.body);
  const data = await questionService.createQuestion(payload, req.auth.userId);

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'CREATE_QUESTION',
    resourceType: 'Question',
    resourceId: data.id,
    metadata: { detail: `Tạo câu hỏi mới (ID: ${data.id})` },
    ipAddress: clientIp(req),
  });

  res.status(201).json({
    success: true,
    message: 'Tạo câu hỏi thành công',
    code: 'QUESTION_CREATED',
    data,
  });
});

export const update = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.questionKind && !Object.values(QUESTION_KIND).includes(payload.questionKind)) {
    throw new ApiError(400, 'questionKind không hợp lệ', 'QUESTION_VALIDATION');
  }
  if (payload.answerType && !Object.values(ANSWER_TYPE).includes(payload.answerType)) {
    throw new ApiError(400, 'answerType không hợp lệ', 'QUESTION_VALIDATION');
  }
  if (payload.difficulty && !Object.values(DIFFICULTY).includes(payload.difficulty)) {
    throw new ApiError(400, 'difficulty không hợp lệ', 'QUESTION_VALIDATION');
  }
  if (payload.scope && !Object.values(QUESTION_SCOPE).includes(payload.scope)) {
    throw new ApiError(400, 'scope không hợp lệ', 'QUESTION_VALIDATION');
  }

  const data = await questionService.updateQuestion(
    req.params.id,
    payload,
    req.auth.userId,
    clientIp(req),
  );

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'UPDATE_QUESTION',
    resourceType: 'Question',
    resourceId: req.params.id,
    metadata: { detail: `Cập nhật câu hỏi (ID: ${req.params.id})` },
    ipAddress: clientIp(req),
  });
  res.json({
    success: true,
    message: 'Cập nhật câu hỏi thành công',
    code: 'QUESTION_UPDATED',
    data,
  });
});

export const remove = asyncHandler(async (req, res) => {
  const data = await questionService.deactivateQuestion(
    req.params.id,
    req.auth.userId,
    clientIp(req),
  );

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'DELETE_QUESTION',
    resourceType: 'Question',
    resourceId: req.params.id,
    metadata: { detail: `Xóa / Ngừng sử dụng câu hỏi (ID: ${req.params.id})` },
    ipAddress: clientIp(req),
  });
  res.json({
    success: true,
    message: 'Đã ngừng sử dụng câu hỏi',
    code: 'QUESTION_DEACTIVATED',
    data,
  });
});

export const importExcel = asyncHandler(async (req, res) => {
  if (!req.file?.path) {
    throw new ApiError(400, 'Thiếu file Excel (field: file)', 'IMPORT_FILE_MISSING');
  }
  const data = await questionService.importQuestionsFromExcelFile(
    req.file.path,
    req.auth.userId,
    req.auth.userId,
    clientIp(req),
  );

  await writeAudit({
    actorUserId: req.auth.userId,
    action: 'IMPORT_QUESTIONS',
    resourceType: 'Question',
    metadata: { detail: `Import câu hỏi từ Excel (Thành công: ${data.imported}, Lỗi: ${data.failed})` },
    ipAddress: clientIp(req),
  });
  res.json({
    success: true,
    message: `Import xong: ${data.imported} thành công, ${data.failed} lỗi`,
    code: 'QUESTION_IMPORT_DONE',
    data,
  });
});
