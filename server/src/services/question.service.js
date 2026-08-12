import fs from 'fs';
import mongoose from 'mongoose';
import XLSX from 'xlsx';
import {
  ANSWER_TYPE,
  DIFFICULTY,
  QUESTION_KIND,
  QUESTION_SCOPE,
  Answer,
  Question,
} from '../models/index.js';
import { ApiError, assertFound } from '../utils/api-error.js';
import { findDepartmentByName } from './department.service.js';
import { findOrCreateTopicByName } from './topic.service.js';
import { writeAudit } from './audit.service.js';

function normalizeKey(key) {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    // Chữ "đ" tiếng Việt là 1 ký tự Unicode riêng (không phải "d" + dấu), nên
    // .normalize('NFD') bên dưới KHÔNG tự tách được nó — phải thay thủ công
    // trước, nếu không các tiêu đề như "Chủ đề"/"Độ khó"/"Đáp án đúng" sẽ
    // không khớp được các key ASCII hệ thống đang chờ (chude/dokho/dapandung).
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '');
}

// Dựng map "key đã chuẩn hoá -> value" để tra cứu qua resolveEnum() luôn khớp,
// vì normalizeKey() sẽ được áp dụng CẢ khi đọc giá trị từ Excel LẪN khi build
// map ở đây (trước đây map khai tay còn dấu/khoảng trắng nên không bao giờ
// khớp được với kết quả normalizeKey(raw), khiến mọi dòng import đều lỗi).
function buildNormalizedMap(pairs) {
  const out = {};
  for (const [rawKeys, value] of pairs) {
    for (const k of rawKeys) {
      out[normalizeKey(k)] = value;
    }
  }
  return out;
}

const DIFFICULTY_MAP = buildNormalizedMap([
  [['easy', 'dễ', 'de'], DIFFICULTY.EASY],
  [['medium', 'trung bình', 'trung binh', 'tb'], DIFFICULTY.MEDIUM],
  [['hard', 'khó', 'kho'], DIFFICULTY.HARD],
]);

const KIND_MAP = buildNormalizedMap([
  [['theory', 'lý thuyết', 'ly thuyet'], QUESTION_KIND.THEORY],
  [['practice', 'bài tập', 'bai tap'], QUESTION_KIND.PRACTICE],
]);

const ANSWER_TYPE_MAP = buildNormalizedMap([
  [['single', 'single choice', 'chọn 1', 'chon 1'], ANSWER_TYPE.SINGLE],
  [['multiple', 'multiple choice', 'chọn nhiều', 'chon nhieu'], ANSWER_TYPE.MULTIPLE],
]);

const SCOPE_MAP = buildNormalizedMap([
  [['common', 'chung'], QUESTION_SCOPE.COMMON],
  [['departmentspecific', 'department', 'riêng', 'rieng'], QUESTION_SCOPE.DEPARTMENT_SPECIFIC],
]);

function mapRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

function parseCorrectIndices(raw) {
  if (raw == null || raw === '') return [];
  const s = String(raw).trim();
  const parts = s.split(/[,;|/]/).map((p) => p.trim()).filter(Boolean);
  const indices = [];
  for (const p of parts) {
    const n = Number.parseInt(p, 10);
    if (!Number.isNaN(n) && n >= 1) {
      indices.push(n);
    }
  }
  return [...new Set(indices)];
}

export function validateAnswerSet(answerType, answers) {
  if (!Array.isArray(answers) || answers.length < 2) {
    throw new ApiError(400, 'Cần ít nhất 2 phương án trả lời', 'QUESTION_ANSWERS_MIN');
  }
  const correct = answers.filter((a) => a.isCorrect);
  if (answerType === ANSWER_TYPE.SINGLE && correct.length !== 1) {
    throw new ApiError(400, 'Câu single choice cần đúng 1 đáp án đúng', 'QUESTION_SINGLE_CORRECT');
  }
  if (answerType === ANSWER_TYPE.MULTIPLE && correct.length < 1) {
    throw new ApiError(400, 'Câu multiple choice cần ít nhất 1 đáp án đúng', 'QUESTION_MULTI_CORRECT');
  }
}

function serializeQuestion(doc, answers) {
  return {
    id: doc._id.toString(),
    content: doc.content,
    questionKind: doc.questionKind,
    answerType: doc.answerType,
    difficulty: doc.difficulty,
    scope: doc.scope,
    topicId: doc.topicId?.toString(),
    departmentId: doc.departmentId?.toString(),
    imageUrl: doc.imageUrl,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    answers: answers.map((a) => ({
      id: a._id.toString(),
      content: a.content,
      isCorrect: a.isCorrect,
      sortOrder: a.sortOrder,
    })),
  };
}

export async function listQuestions(filters = {}) {
  const {
    topicId,
    scope,
    departmentId,
    questionKind,
    difficulty,
    answerType,
    isActive = true,
    search,
    page = 1,
    limit = 20,
  } = filters;

  const query = {};
  if (isActive !== undefined && isActive !== 'all') {
    query.isActive = isActive === true || isActive === 'true';
  }
  if (topicId) query.topicId = topicId;
  if (scope) query.scope = scope;
  if (departmentId) query.departmentId = departmentId;
  if (questionKind) query.questionKind = questionKind;
  if (difficulty) query.difficulty = difficulty;
  if (answerType) query.answerType = answerType;
  if (search?.trim()) {
    query.content = { $regex: search.trim(), $options: 'i' };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    Question.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    Question.countDocuments(query),
  ]);

  const ids = items.map((q) => q._id);
  const answers = await Answer.find({ questionId: { $in: ids } }).sort({ sortOrder: 1 }).lean();
  const byQuestion = new Map();
  for (const a of answers) {
    const key = a.questionId.toString();
    if (!byQuestion.has(key)) byQuestion.set(key, []);
    byQuestion.get(key).push(a);
  }

  return {
    items: items.map((q) => serializeQuestion(q, byQuestion.get(q._id.toString()) ?? [])),
    pagination: { page: safePage, limit: safeLimit, total },
  };
}

export async function getQuestionById(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'ID câu hỏi không hợp lệ', 'QUESTION_ID_INVALID');
  }
  const question = await Question.findById(id);
  assertFound(question, 'Không tìm thấy câu hỏi', 'QUESTION_NOT_FOUND');
  const answers = await Answer.find({ questionId: question._id }).sort({ sortOrder: 1 });
  return serializeQuestion(question, answers);
}

async function replaceAnswers(questionId, answersInput) {
  await Answer.deleteMany({ questionId });
  const toInsert = answersInput.map((a, index) => ({
    questionId,
    content: a.content.trim(),
    isCorrect: Boolean(a.isCorrect),
    sortOrder: a.sortOrder ?? index,
  }));
  await Answer.insertMany(toInsert);
}

export async function createQuestion(payload, createdBy) {
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
  } = payload;

  if (!content?.trim()) {
    throw new ApiError(400, 'Nội dung câu hỏi là bắt buộc', 'QUESTION_VALIDATION');
  }
  if (!topicId) {
    throw new ApiError(400, 'topicId là bắt buộc', 'QUESTION_VALIDATION');
  }

  validateAnswerSet(answerType, answers);

  const question = await Question.create({
    content: content.trim(),
    questionKind,
    answerType,
    difficulty,
    scope,
    topicId,
    departmentId: scope === QUESTION_SCOPE.DEPARTMENT_SPECIFIC ? departmentId : undefined,
    imageUrl,
    createdBy,
  });

  await replaceAnswers(question._id, answers);
  return getQuestionById(question._id);
}

export async function updateQuestion(id, payload, actorUserId, ipAddress) {
  const question = await Question.findById(id);
  assertFound(question, 'Không tìm thấy câu hỏi', 'QUESTION_NOT_FOUND');

  const fields = [
    'content',
    'questionKind',
    'answerType',
    'difficulty',
    'scope',
    'topicId',
    'departmentId',
    'imageUrl',
    'isActive',
  ];
  for (const f of fields) {
    if (payload[f] !== undefined) question[f] = payload[f];
  }
  if (question.scope === QUESTION_SCOPE.COMMON) {
    question.departmentId = undefined;
  }

  if (payload.answers) {
    validateAnswerSet(question.answerType, payload.answers);
  }

  await question.save();

  if (payload.answers) {
    await replaceAnswers(question._id, payload.answers);
  }

  await writeAudit({
    actorUserId,
    action: 'question.update',
    resourceType: 'Question',
    resourceId: question._id,
    metadata: { questionId: question._id.toString() },
    ipAddress,
  });

  return getQuestionById(question._id);
}

export async function deactivateQuestion(id, actorUserId, ipAddress) {
  const question = await Question.findById(id);
  assertFound(question, 'Không tìm thấy câu hỏi', 'QUESTION_NOT_FOUND');
  question.isActive = false;
  await question.save();

  await writeAudit({
    actorUserId,
    action: 'question.deactivate',
    resourceType: 'Question',
    resourceId: question._id,
    metadata: { questionId: question._id.toString() },
    ipAddress,
  });

  return { id: question._id.toString(), isActive: false };
}

function resolveEnum(map, raw, fieldLabel) {
  const key = normalizeKey(raw);
  const val = map[key];
  if (!val) {
    throw new ApiError(400, `Giá trị không hợp lệ: ${fieldLabel}`, 'IMPORT_ROW_INVALID');
  }
  return val;
}

async function buildQuestionFromImportRow(row, rowIndex) {
  const r = mapRowKeys(row);
  const topicName = r.topic ?? r.chude ?? r.chudelon ?? r.topicname;
  const content = r.content ?? r.noidung ?? r.cauhoi;
  if (!topicName || !content) {
    throw new ApiError(
      400,
      `Dòng ${rowIndex}: thiếu chủ đề hoặc nội dung câu hỏi`,
      'IMPORT_ROW_INVALID',
    );
  }

  const topic = await findOrCreateTopicByName(String(topicName));

  const scope = resolveEnum(SCOPE_MAP, r.scope ?? r.phamvi ?? 'common', 'scope');
  let departmentId;
  if (scope === QUESTION_SCOPE.DEPARTMENT_SPECIFIC) {
    const deptName = r.department ?? r.bophan ?? r.bophanname;
    if (!deptName) {
      throw new ApiError(
        400,
        `Dòng ${rowIndex}: scope riêng cần tên bộ phận`,
        'IMPORT_ROW_INVALID',
      );
    }
    const dept = await findDepartmentByName(String(deptName));
    if (!dept) {
      throw new ApiError(
        400,
        `Dòng ${rowIndex}: không tìm thấy bộ phận "${deptName}"`,
        'IMPORT_DEPARTMENT_NOT_FOUND',
      );
    }
    departmentId = dept._id;
  }

  const questionKind = resolveEnum(
    KIND_MAP,
    r.questionkind ?? r.loai ?? r.kind ?? 'theory',
    'questionKind',
  );
  const answerType = resolveEnum(
    ANSWER_TYPE_MAP,
    r.answertype ?? r.dapan ?? r.answer_type ?? 'single',
    'answerType',
  );
  const difficulty = resolveEnum(
    DIFFICULTY_MAP,
    r.difficulty ?? r.dokho ?? 'medium',
    'difficulty',
  );

  const options = [];
  for (let i = 1; i <= 8; i += 1) {
    const key = `option${i}`;
    const alt = `luachon${i}`;
    const val = r[key] ?? r[alt];
    if (val != null && String(val).trim() !== '') {
      options.push({ index: i, content: String(val).trim() });
    }
  }
  if (options.length < 2) {
    throw new ApiError(400, `Dòng ${rowIndex}: cần ít nhất 2 phương án`, 'IMPORT_ROW_INVALID');
  }

  const correctRaw = r.correct ?? r.dapanung ?? r.correctoptions ?? r.dapandung;
  const correctIndices = parseCorrectIndices(correctRaw);
  if (correctIndices.length === 0) {
    throw new ApiError(400, `Dòng ${rowIndex}: thiếu đáp án đúng (correct)`, 'IMPORT_ROW_INVALID');
  }

  const answers = options.map((o) => ({
    content: o.content,
    isCorrect: correctIndices.includes(o.index),
    sortOrder: o.index - 1,
  }));

  validateAnswerSet(answerType, answers);

  return {
    content: String(content).trim(),
    questionKind,
    answerType,
    difficulty,
    scope,
    topicId: topic._id,
    departmentId,
    answers,
  };
}

export async function importQuestionsFromExcelFile(filePath, createdBy, actorUserId, ipAddress) {
  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, 'Không đọc được file upload', 'IMPORT_FILE_MISSING');
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ApiError(400, 'File Excel không có sheet', 'IMPORT_EMPTY');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rows.length) {
    throw new ApiError(400, 'Sheet trống', 'IMPORT_EMPTY');
  }

  const created = [];
  const errors = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rowIndex = i + 2;
    try {
      const payload = await buildQuestionFromImportRow(rows[i], rowIndex);
      const question = await Question.create({
        content: payload.content,
        questionKind: payload.questionKind,
        answerType: payload.answerType,
        difficulty: payload.difficulty,
        scope: payload.scope,
        topicId: payload.topicId,
        departmentId: payload.departmentId,
        createdBy,
      });
      await replaceAnswers(question._id, payload.answers);
      created.push(question._id.toString());
    } catch (err) {
      errors.push({
        row: rowIndex,
        message: err.message ?? 'Lỗi không xác định',
        code: err.code ?? 'IMPORT_ROW_ERROR',
      });
    }
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore cleanup */
  }

  if (created.length > 0) {
    await writeAudit({
      actorUserId,
      action: 'question.import',
      resourceType: 'Question',
      metadata: { count: created.length, failedRows: errors.length },
      ipAddress,
    });
  }

  return {
    imported: created.length,
    failed: errors.length,
    errors,
    questionIds: created,
  };
}