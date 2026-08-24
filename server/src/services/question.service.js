import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import XLSX from 'xlsx';
import { v2 as cloudinary } from 'cloudinary';
import {
  ANSWER_TYPE,
  DIFFICULTY,
  QUESTION_KIND,
  QUESTION_SCOPE,
  EXAM_STATUS,
  Answer,
  Question,
  Department,
  Exam,
} from '../models/index.js';
import { ApiError, assertFound } from '../utils/api-error.js';
import { findDepartmentByName, findOrCreateDepartmentByName, upsertDepartmentForImport } from './department.service.js';
import { normalizeDeptName } from '../models/department.model.js';
import { findOrCreateTopicByName } from './topic.service.js';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

const CLOUDINARY_QUESTION_FOLDER = 'z176/questions';

function uploadBufferToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

/**
 * Upload 1 ảnh câu hỏi lên Cloudinary. public_id = hash SHA-256 nội dung
 * file (không để Cloudinary tự sinh ID) + overwrite:true — 2 câu hỏi dùng
 * chung ảnh giống hệt nhau sẽ tự dùng chung 1 asset, import/upload lại đúng
 * ảnh cũ sẽ ghi đè thay vì tạo bản sao.
 */
export async function uploadQuestionImageBuffer(buffer) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const publicId = `${CLOUDINARY_QUESTION_FOLDER}/${hash}`;
  const result = await uploadBufferToCloudinary(buffer, publicId);
  return { imageUrl: result.secure_url, imageCloudinaryId: result.public_id };
}

/**
 * Xoá 1 asset ảnh câu hỏi trên Cloudinary theo public_id. Không throw nếu
 * xoá lỗi (vd asset đã bị xoá tay từ trước) — lỗi Cloudinary không được
 * chặn luồng cập nhật câu hỏi trong DB.
 */
async function deleteQuestionImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.error('Cloudinary destroy thất bại:', publicId, err.message);
  }
}

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

// Dùng riêng cho việc SO KHỚP TRÙNG LẶP nội dung câu hỏi khi import (khác
// normalizeKey ở trên — cái đó dùng để khớp TÊN CỘT Excel). Ở đây giữ lại
// khoảng trắng đơn (chỉ gộp nhiều khoảng trắng liên tiếp) để "Câu hỏi A" và
// "Câu hỏi A " hay "Câu   hỏi A" vẫn coi là trùng, nhưng không đi xa tới mức
// bỏ hết dấu cách khiến 2 câu khác nghĩa bị nhận nhầm là 1.
function normalizeContentForDedupe(content) {
  return String(content ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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
    imageCloudinaryId: doc.imageCloudinaryId,
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

function buildQuestionQuery(filters = {}) {
  const { topicId, scope, departmentId, questionKind, difficulty, answerType, isActive = true, search } = filters;
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
  return query;
}

export async function listQuestions(filters = {}) {
  const { page = 1, limit = 20 } = filters;
  const query = buildQuestionQuery(filters);

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
    imageCloudinaryId,
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
    imageCloudinaryId,
    createdBy,
  });

  await replaceAnswers(question._id, answers);
  return getQuestionById(question._id);
}

export async function updateQuestion(id, payload, actorUserId, ipAddress) {
  const question = await Question.findById(id);
  assertFound(question, 'Không tìm thấy câu hỏi', 'QUESTION_NOT_FOUND');

  const previousCloudinaryId = question.imageCloudinaryId;

  const fields = [
    'content',
    'questionKind',
    'answerType',
    'difficulty',
    'scope',
    'topicId',
    'departmentId',
    'imageUrl',
    'imageCloudinaryId',
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

  // Chỉ xoá asset Cloudinary CŨ khi client thực sự gửi imageCloudinaryId
  // MỚI khác với ảnh đang lưu (đổi sang ảnh khác, hoặc gỡ ảnh = gửi null).
  // Xoá mềm câu hỏi (deactivateQuestion) KHÔNG đụng nhánh này — theo yêu
  // cầu giữ nguyên ảnh trên Cloudinary phòng khi cần khôi phục dữ liệu.
  if (
    payload.imageCloudinaryId !== undefined &&
    previousCloudinaryId &&
    previousCloudinaryId !== question.imageCloudinaryId
  ) {
    await deleteQuestionImage(previousCloudinaryId);
  }

  // Audit: KHÔNG ghi ở đây nữa — question.controller.js đã ghi audit log
  // đúng chuẩn (action: 'UPDATE_QUESTION', kèm metadata.detail) ngay sau khi
  // gọi hàm này. Log dạng 'question.update' ở đây bị trùng với log đó (2
  // dòng log cho cùng 1 lần cập nhật câu hỏi).

  return getQuestionById(question._id);
}

// Trả về Exam đang PUBLISHED (nếu có) đang dùng ÍT NHẤT 1 trong các chủ đề
// (topicId) truyền vào — dùng chung cho cả xóa đơn lẻ và xóa hàng loạt.
//
// LƯU Ý: chặn theo TOPIC của câu hỏi, KHÔNG chặn theo việc câu hỏi cụ thể đó
// có thực sự nằm trong ExamCodeQuestion (snapshot lúc publish) hay không.
// Trước đây hệ thống chỉ chặn câu hỏi đã được snapshot vào đề thi, nên 1 chủ
// đề có 100 câu nhưng đề thi chỉ dùng 63 câu thì 37 câu còn lại vẫn xóa được
// — điều này khiến hệ thống query lại Question theo topicId với isActive:true
// (vd lúc sinh ExamCode mới cho nhân viên mới được gán vào phòng ban chưa có
// ExamCode) bị thiếu số lượng câu so với lúc đề thi được duyệt, dẫn tới lỗi
// INSUFFICIENT_QUESTIONS bị nuốt lặng lẽ. Để an toàn tuyệt đối, MỌI câu hỏi
// thuộc 1 chủ đề đang được dùng bởi kỳ thi published — dù có nằm trong đề đã
// sinh hay không — đều bị CHẶN xóa cho tới khi kỳ thi đó kết thúc.
async function findActiveExamUsingTopics(topicIds) {
  const ids = [...new Set(topicIds.filter(Boolean).map((id) => id.toString()))];
  if (ids.length === 0) return null;
  return Exam.findOne({ topicId: { $in: ids }, status: EXAM_STATUS.PUBLISHED });
}

export async function deactivateQuestion(id, actorUserId, ipAddress) {
  const question = await Question.findById(id);
  assertFound(question, 'Không tìm thấy câu hỏi', 'QUESTION_NOT_FOUND');

  const activeExam = await findActiveExamUsingTopics([question.topicId]);
  if (activeExam) {
    throw new ApiError(
      409,
      `Không thể ngừng sử dụng câu hỏi này vì chủ đề của câu hỏi đang được dùng cho kỳ thi "${activeExam.title}" đang diễn ra (áp dụng cho toàn bộ câu hỏi trong chủ đề, kể cả câu chưa được đưa vào đề). Vui lòng đợi kỳ thi kết thúc rồi thử lại.`,
      'QUESTION_HAS_ACTIVE_EXAM',
    );
  }

  question.isActive = false;
  await question.save();

  // Audit: KHÔNG ghi ở đây nữa — question.controller.js đã ghi audit log
  // đúng chuẩn (action: 'DELETE_QUESTION', kèm metadata.detail) ngay sau khi
  // gọi hàm này, cùng lý do như updateQuestion() ở trên — tránh trùng log.

  return { id: question._id.toString(), isActive: false };
}

/**
 * Xóa mềm HÀNG LOẠT — 2 chế độ:
 *  - { ids: [...] }: chỉ xóa đúng các câu hỏi có id trong danh sách (dùng
 *    khi người dùng tick chọn từng câu qua checkbox).
 *  - { filters: {...} }: xóa TẤT CẢ câu hỏi khớp bộ lọc hiện tại trên UI
 *    (dùng khi người dùng bấm "Xóa tất cả theo bộ lọc hiện tại" — tiện dọn
 *    dữ liệu test/trùng lặp mà không cần tick từng ô). Bắt buộc phải có ít
 *    nhất 1 điều kiện lọc CỤ THỂ ngoài isActive, để tránh xóa nhầm toàn bộ
 *    ngân hàng câu hỏi chỉ vì quên chọn bộ lọc.
 * Chỉ tác động tới câu hỏi đang isActive:true (đã xóa mềm rồi thì bỏ qua).
 */
export async function deactivateManyQuestions({ ids, filters } = {}, actorUserId, ipAddress) {
  let query;
  if (Array.isArray(ids) && ids.length > 0) {
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) {
      throw new ApiError(400, 'Danh sách ID không hợp lệ', 'QUESTION_BULK_DELETE_INVALID_IDS');
    }
    query = { _id: { $in: validIds }, isActive: true };
  } else if (filters && typeof filters === 'object') {
    const hasSpecificFilter = ['topicId', 'scope', 'departmentId', 'questionKind', 'difficulty', 'answerType', 'search']
      .some((k) => filters[k] !== undefined && filters[k] !== null && filters[k] !== '');
    if (!hasSpecificFilter) {
      throw new ApiError(
        400,
        'Vui lòng chọn ít nhất 1 bộ lọc (chủ đề, phạm vi, bộ phận, độ khó...) trước khi xóa tất cả, để tránh xóa nhầm toàn bộ ngân hàng câu hỏi.',
        'QUESTION_BULK_DELETE_NO_FILTER',
      );
    }
    query = buildQuestionQuery({ ...filters, isActive: true });
  } else {
    throw new ApiError(400, 'Thiếu ids hoặc filters để xóa hàng loạt', 'QUESTION_BULK_DELETE_MISSING_PARAMS');
  }

  const matched = await Question.find(query).select('topicId').lean();
  if (matched.length === 0) {
    return { deactivatedCount: 0, questionIds: [], skippedActiveExam: null };
  }

  // Xóa hàng loạt có thể gộp câu hỏi từ nhiều chủ đề/phòng ban khác nhau —
  // nếu CHỈ 1 chủ đề trong số đó đang được kỳ thi published dùng, chặn toàn
  // bộ thao tác sẽ rất khó chịu cho người xóa hàng loạt (họ không biết chủ
  // đề nào là "thủ phạm" để bỏ ra khỏi lựa chọn). Thay vào đó: loại TOÀN BỘ
  // câu hỏi thuộc (các) chủ đề đang bị kỳ thi active dùng ra khỏi danh sách
  // xóa — bất kể câu đó có thực sự nằm trong đề đã sinh hay không — xóa phần
  // còn lại, và báo rõ tên kỳ thi + có bao nhiêu câu bị giữ lại để người dùng
  // tự xử lý.
  const topicIds = [...new Set(matched.map((q) => q.topicId?.toString()).filter(Boolean))];
  const activeExams = await Exam.find({ topicId: { $in: topicIds }, status: EXAM_STATUS.PUBLISHED })
    .select('topicId title')
    .lean();

  const blockedTopicIds = new Set(activeExams.map((e) => e.topicId.toString()));
  const blocked = matched.filter((q) => blockedTopicIds.has(q.topicId?.toString()));
  const idsToDeactivate = matched
    .filter((q) => !blockedTopicIds.has(q.topicId?.toString()))
    .map((q) => q._id);

  if (idsToDeactivate.length > 0) {
    await Question.updateMany({ _id: { $in: idsToDeactivate } }, { $set: { isActive: false } });
  }

  // Audit: KHÔNG ghi ở đây nữa — question.controller.js đã ghi audit log
  // đúng chuẩn (action: 'BULK_DELETE_QUESTIONS', kèm metadata.detail) ngay
  // sau khi gọi hàm này, cùng lý do như updateQuestion() ở trên — tránh
  // trùng log.

  return {
    deactivatedCount: idsToDeactivate.length,
    questionIds: idsToDeactivate.map((id) => id.toString()),
    skippedActiveExam:
      blocked.length > 0
        ? { examTitle: activeExams.map((e) => e.title).join(', '), skippedCount: blocked.length }
        : null,
  };
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
      const err = new ApiError(
        400,
        `Dòng ${rowIndex}: không tìm thấy bộ phận "${deptName}"`,
        'IMPORT_DEPARTMENT_NOT_FOUND',
      );
      // Đính kèm tên bộ phận gốc (chưa chuẩn hoá) để bước preview gom nhóm
      // các dòng cùng thiếu 1 bộ phận và hiển thị cho người dùng tạo ngay.
      err.departmentName = String(deptName).trim();
      // Nếu file Excel có sẵn cột "Mã bộ phận" / "Mô tả bộ phận" thì lấy
      // luôn để UI tiền điền (và khoá không cho sửa) trong modal preview —
      // tránh người dùng phải gõ lại dữ liệu đã có sẵn trong file.
      err.departmentCode = String(r.mabophan ?? r.maboph ?? r.deptcode ?? '').trim();
      err.departmentDescription = String(r.motabophan ?? r.mota ?? r.deptdescription ?? '').trim();
      throw err;
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

function readImportRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new ApiError(400, 'Không đọc được file upload', 'IMPORT_FILE_MISSING');
  }

  let workbook;
  try {
    workbook = XLSX.readFile(filePath, { cellDates: false });
  } catch (err) {
    // Thư viện xlsx ném lỗi kỹ thuật khó hiểu (vd "Corrupted zip",
    // "Unsupported file") khi file không phải Excel thật — thường gặp nhất
    // là file đổi đuôi tay (.txt -> .xlsx) hoặc file Excel bị hỏng giữa
    // chừng lúc upload. Bọc lại thành ApiError tiếng Việt rõ ràng để người
    // ra đề biết cần tải lại đúng file Excel, thay vì thấy lỗi 500 thô.
    throw new ApiError(
      400,
      'File không đúng định dạng Excel hoặc đã bị hỏng. Vui lòng kiểm tra lại file (.xlsx) và tải lên lại.',
      'IMPORT_INVALID_FORMAT',
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ApiError(400, 'File Excel không có sheet', 'IMPORT_EMPTY');
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (!rows.length) {
    throw new ApiError(400, 'Sheet trống', 'IMPORT_EMPTY');
  }
  return rows;
}

async function loadSeenKeys() {
  // Tải trước toàn bộ câu hỏi ACTIVE hiện có để so khớp trùng lặp — so theo
  // (topicId + scope + departmentId + content đã chuẩn hoá). Dùng Set thay vì
  // query DB từng dòng để tránh N+1 query khi file có hàng trăm dòng.
  const existingQuestions = await Question.find({ isActive: true }, 'content topicId scope departmentId').lean();
  return new Set(
    existingQuestions.map((q) =>
      [
        q.topicId?.toString() ?? '',
        q.scope,
        q.departmentId?.toString() ?? '',
        normalizeContentForDedupe(q.content),
      ].join('|'),
    ),
  );
}

function buildDedupeKey(payload) {
  return [
    payload.topicId?.toString() ?? '',
    payload.scope,
    payload.departmentId?.toString() ?? '',
    normalizeContentForDedupe(payload.content),
  ].join('|');
}

// Token dùng để tham chiếu lại đúng file Excel đã upload ở bước preview khi
// gọi confirm (client không gửi lại file, chỉ gửi token). Token = tên file
// vật lý multer đã lưu trong uploadDir — chỉ lấy basename để chặn path
// traversal (vd token = "../../etc/passwd").
function resolveImportTokenPath(token) {
  const safe = path.basename(String(token ?? ''));
  if (!safe || safe !== token) {
    throw new ApiError(400, 'Token import không hợp lệ', 'IMPORT_TOKEN_INVALID');
  }
  return path.join(path.resolve(env.uploadDir), safe);
}

/**
 * BƯỚC 1/2 — Đọc file Excel và PHÂN TÍCH TRƯỚC, KHÔNG ghi gì vào DB (trừ
 * topic — vẫn tự tạo topic mới nếu chưa có, theo đúng hành vi cũ). Trả về:
 *  - missingDepartments: tên bộ phận còn thiếu (gom theo tên, không lặp) để
 *    UI cho người ra đề tạo ngay trong modal preview.
 *  - duplicates: các dòng trùng với câu hỏi đã có sẵn (DB cũ hoặc trùng
 *    ngay trong file) — để người dùng chọn giữ/bỏ từng dòng.
 *  - ready: các dòng sạch, sẵn sàng import ngay.
 *  - errors: lỗi khác (sai định dạng, thiếu đáp án đúng...) — luôn bị bỏ
 *    qua, không thể "cứu" ở bước confirm.
 * File Excel GIỮ NGUYÊN trên đĩa (chưa xoá) để bước confirm đọc lại.
 */
export async function previewImportQuestionsFromExcelFile(filePath) {
  const rows = readImportRows(filePath);
  const seenKeys = await loadSeenKeys();

  const ready = [];
  const duplicates = [];
  const errors = [];
  // normalizeDeptName -> { name, code, description, rowCount } — rowCount
  // để UI biết tick tạo bộ phận này sẽ "cứu" thêm được bao nhiêu câu hỏi,
  // hiển thị đúng số câu sẽ import ngay trong modal preview.
  const missingDepts = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const rowIndex = i + 2;
    try {
      const payload = await buildQuestionFromImportRow(rows[i], rowIndex);
      const dedupeKey = buildDedupeKey(payload);
      if (seenKeys.has(dedupeKey)) {
        duplicates.push({ row: rowIndex, content: payload.content.slice(0, 120) });
      } else {
        seenKeys.add(dedupeKey);
        ready.push({ row: rowIndex, content: payload.content.slice(0, 120) });
      }
    } catch (err) {
      if (err.code === 'IMPORT_DEPARTMENT_NOT_FOUND') {
        const key = normalizeDeptName(err.departmentName);
        const entry = missingDepts.get(key) ?? {
          name: err.departmentName,
          code: '',
          description: '',
          rowCount: 0,
        };
        entry.rowCount += 1;
        // Chỉ điền nếu chưa có — ưu tiên giá trị từ dòng gặp trước, tránh
        // dòng sau có ô trống lại xoá mất giá trị dòng trước đã cung cấp.
        if (!entry.code && err.departmentCode) entry.code = err.departmentCode;
        if (!entry.description && err.departmentDescription) entry.description = err.departmentDescription;
        missingDepts.set(key, entry);
      }
      errors.push({
        row: rowIndex,
        message: err.message ?? 'Lỗi không xác định',
        code: err.code ?? 'IMPORT_ROW_ERROR',
      });
    }
  }

  return {
    token: path.basename(filePath),
    totalRows: rows.length,
    readyCount: ready.length,
    duplicateCount: duplicates.length,
    errorCount: errors.length,
    missingDepartments: [...missingDepts.values()],
    duplicates,
    ready,
    errors,
  };
}

/**
 * BƯỚC 2/2 — Xác nhận import thật sau khi người dùng đã xem preview:
 *  - createDepartments: [{ name }] — các bộ phận người dùng chọn tạo ngay
 *    (vd lấy từ missingDepartments của bước preview).
 *  - keepDuplicateRows: [rowIndex, ...] — các dòng TRÙNG mà người dùng vẫn
 *    muốn thêm mới (mặc định: dòng trùng KHÔNG có trong danh sách này sẽ bị
 *    bỏ qua, giữ câu cũ).
 * Đọc lại đúng file đã upload ở bước preview qua `token`, xoá file sau khi
 * xử lý xong (thành công hay có lỗi từng dòng cũng xoá, giống hành vi cũ).
 */
export async function confirmImportQuestions(token, options, createdBy, actorUserId, ipAddress) {
  const { createDepartments = [], keepDuplicateRows = [] } = options ?? {};
  const filePath = resolveImportTokenPath(token);
  if (!fs.existsSync(filePath)) {
    throw new ApiError(
      400,
      'Phiên import đã hết hạn hoặc đã được xử lý, vui lòng tải file lên lại',
      'IMPORT_TOKEN_EXPIRED',
    );
  }

  // Tạo các bộ phận còn thiếu TRƯỚC KHI ghi bất kỳ câu hỏi nào. Nếu bước
  // này lỗi (thiếu mã, mã bị trùng...), dừng ngay tại đây — KHÔNG ghi câu
  // hỏi nào cả — và trả lỗi rõ ràng để người dùng sửa lại mã/mô tả rồi bấm
  // "Xác nhận nhập" lại luôn trong modal, không cần thoát ra ngoài tạo tay
  // phòng ban ở tab riêng rồi import lại từ đầu.
  for (const dept of createDepartments) {
    const name = dept?.name?.trim();
    if (!name) continue;

    const code = dept?.code?.trim();
    if (!code) {
      throw new ApiError(
        400,
        `Vui lòng nhập mã bộ phận cho "${name}" trước khi import, hoặc bỏ tick "Tạo bộ phận mới" để bỏ qua các câu hỏi riêng của bộ phận này.`,
        'IMPORT_DEPARTMENT_CODE_REQUIRED',
      );
    }

    // upsertDepartmentForImport tự lo hết: đã có + active -> dùng luôn; đã có
    // nhưng bị xoá mềm -> khôi phục lại với mã/mô tả mới; chưa có -> tạo mới.
    // Không cần tự check tồn tại ở đây nữa để tránh bỏ sót trường hợp xoá mềm.
    try {
      await upsertDepartmentForImport({ name, code, description: dept?.description });
    } catch (err) {
      // upsertDepartmentForImport đã tự chuyển lỗi trùng khoá thành ApiError
      // dễ hiểu — chỉ cần ném tiếp lên.
      throw err;
    }
  }

  const rows = readImportRows(filePath);
  const seenKeys = await loadSeenKeys();
  const keepSet = new Set(keepDuplicateRows);

  const created = [];
  const errors = [];
  const skippedDuplicates = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rowIndex = i + 2;
    try {
      const payload = await buildQuestionFromImportRow(rows[i], rowIndex);
      const dedupeKey = buildDedupeKey(payload);

      if (seenKeys.has(dedupeKey) && !keepSet.has(rowIndex)) {
        // Trùng và người dùng KHÔNG chọn giữ dòng này -> bỏ qua, không tạo
        // trùng (mặc định an toàn).
        skippedDuplicates.push({ row: rowIndex, content: payload.content.slice(0, 80) });
        continue;
      }

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
      seenKeys.add(dedupeKey); // đánh dấu luôn để dòng sau trong CÙNG file không tạo trùng nhau
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

  // Audit: KHÔNG ghi ở đây nữa — question.controller.js đã ghi audit log
  // đúng chuẩn (action: 'IMPORT_QUESTIONS', kèm metadata.detail đầy đủ cả
  // số dòng thành công/lỗi/bỏ qua trùng) ngay sau khi gọi hàm này, cùng lý
  // do như updateQuestion() ở trên — tránh trùng log. Giữ nguyên logic
  // created.length > 0 không còn cần thiết vì controller luôn ghi log dù
  // created.length = 0 hay không, để không mất dấu vết các lần import lỗi
  // toàn bộ.

  return {
    imported: created.length,
    failed: errors.length,
    skipped: skippedDuplicates.length,
    errors,
    skippedDuplicates,
    questionIds: created,
  };
}

/**
 * Thống kê số câu hỏi ACTIVE theo 1 chủ đề, dùng cho form "Tạo đề xuất kỳ
 * thi" (ExamProposalTab) — giúp người soạn biết trước tối đa có thể nhập
 * bao nhiêu câu chung / câu riêng cho từng phòng ban, tránh nhập vượt quá số
 * câu thực có trong ngân hàng câu hỏi.
 *
 * Trả về: { topicId, commonCount, departments: [{ departmentId, name, code, count }] }
 * `departments` liệt kê TẤT CẢ phòng ban đang hoạt động (kể cả phòng ban 0
 * câu hỏi riêng thuộc chủ đề này), để UI hiển thị đủ, không bị ẩn mất phòng
 * ban thiếu câu hỏi.
 */
export async function getQuestionStatsByTopic(topicId) {
  if (!mongoose.isValidObjectId(topicId)) {
    throw new ApiError(400, 'topicId không hợp lệ', 'QUESTION_STATS_INVALID_TOPIC');
  }

  const [commonCount, deptCountsRaw, departments] = await Promise.all([
    Question.countDocuments({
      topicId,
      scope: QUESTION_SCOPE.COMMON,
      isActive: true,
    }),
    Question.aggregate([
      {
        $match: {
          topicId: new mongoose.Types.ObjectId(topicId),
          scope: QUESTION_SCOPE.DEPARTMENT_SPECIFIC,
          isActive: true,
        },
      },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]),
    Department.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);

  const countByDeptId = new Map(deptCountsRaw.map((d) => [d._id.toString(), d.count]));

  return {
    topicId,
    commonCount,
    departments: departments.map((dept) => ({
      departmentId: dept._id.toString(),
      name: dept.name,
      code: dept.code,
      count: countByDeptId.get(dept._id.toString()) ?? 0,
    })),
  };
}