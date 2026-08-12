import crypto from 'node:crypto';
import {
  Department,
  Employee,
  Question,
  ExamCode,
  ExamCodeQuestion,
  ExamCandidate,
  QUESTION_SCOPE,
} from '../models/index.js';
import { ApiError } from '../utils/api-error.js';

/** Trộn ngẫu nhiên mảng (Fisher–Yates), không sửa mảng gốc. */
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandom(arr, count) {
  return shuffle(arr).slice(0, count);
}

function computeFingerprint(questionIds) {
  const sorted = [...questionIds].map(String).sort();
  return crypto.createHash('sha256').update(sorted.join(',')).digest('hex');
}

/**
 * Sinh mã đề (ExamCode + ExamCodeQuestion) cho từng phòng ban đang có nhân
 * viên active, rồi gán (ExamCandidate) toàn bộ nhân viên active của phòng ban
 * đó vào đúng mã đề. Chạy 1 lần khi kỳ thi được Publish.
 *
 * Idempotent ở mức cơ bản: nếu exam đã có ExamCode rồi (vd gọi lại do retry)
 * thì bỏ qua, không sinh chồng lấn.
 *
 * Ném lỗi (chặn publish) nếu ngân hàng câu hỏi (chung hoặc riêng của 1 phòng
 * ban có nhân viên) không đủ số lượng theo yêu cầu của Exam.
 */
export async function generateExamCodesAndAssignCandidates(exam) {
  const existingCodesCount = await ExamCode.countDocuments({ examId: exam._id });
  if (existingCodesCount > 0) {
    return; // đã sinh mã đề cho kỳ thi này rồi, không sinh lại
  }

  const employees = await Employee.find({ isActive: true }).select('_id departmentId');
  const employeesByDept = new Map();
  for (const emp of employees) {
    const key = emp.departmentId.toString();
    if (!employeesByDept.has(key)) employeesByDept.set(key, []);
    employeesByDept.get(key).push(emp);
  }

  if (employeesByDept.size === 0) {
    throw new ApiError(400, 'Không có nhân viên nào đang hoạt động để gán đề thi', 'NO_ACTIVE_EMPLOYEES');
  }

  const departments = await Department.find({
    isActive: true,
    _id: { $in: [...employeesByDept.keys()] },
  });

  const commonQuestions = await Question.find({
    topicId: exam.topicId,
    scope: QUESTION_SCOPE.COMMON,
    isActive: true,
  });
  if (commonQuestions.length < exam.commonQuestionCount) {
    throw new ApiError(
      400,
      `Ngân hàng câu hỏi chung của chủ đề không đủ: cần ${exam.commonQuestionCount} câu, hiện chỉ có ${commonQuestions.length} câu. Vui lòng bổ sung câu hỏi trước khi phát hành.`,
      'INSUFFICIENT_COMMON_QUESTIONS',
    );
  }

  // Kiểm tra đủ câu hỏi riêng cho TỪNG phòng ban trước, chặn ngay nếu thiếu bất
  // kỳ phòng ban nào — tránh tình trạng publish dở dang (1 số phòng ban có mã
  // đề, số khác thì không).
  const deptQuestionPools = new Map();
  for (const dept of departments) {
    const pool = await Question.find({
      topicId: exam.topicId,
      scope: QUESTION_SCOPE.DEPARTMENT_SPECIFIC,
      departmentId: dept._id,
      isActive: true,
    });
    if (pool.length < exam.departmentQuestionCount) {
      throw new ApiError(
        400,
        `Phòng ban "${dept.name}" không đủ câu hỏi riêng: cần ${exam.departmentQuestionCount} câu, hiện chỉ có ${pool.length} câu. Vui lòng bổ sung câu hỏi trước khi phát hành.`,
        'INSUFFICIENT_DEPARTMENT_QUESTIONS',
      );
    }
    deptQuestionPools.set(dept._id.toString(), pool);
  }

  const candidateDocs = [];

  for (const dept of departments) {
    const commonPick = pickRandom(commonQuestions, exam.commonQuestionCount);
    const deptPick = pickRandom(deptQuestionPools.get(dept._id.toString()), exam.departmentQuestionCount);
    const allQuestions = shuffle([...commonPick, ...deptPick]);

    const codeSuffix = (dept.code || dept.name).replace(/\s+/g, '').toUpperCase().slice(0, 10);
    const code = `${exam._id.toString().slice(-6).toUpperCase()}-${codeSuffix}`;

    const examCode = await ExamCode.create({
      examId: exam._id,
      code,
      departmentId: dept._id,
      questionSetFingerprint: computeFingerprint(allQuestions.map((q) => q._id)),
    });

    const examCodeQuestionDocs = allQuestions.map((q, index) => ({
      examCodeId: examCode._id,
      questionId: q._id,
      orderIndex: index,
    }));
    await ExamCodeQuestion.insertMany(examCodeQuestionDocs);

    const deptEmployees = employeesByDept.get(dept._id.toString()) || [];
    for (const emp of deptEmployees) {
      candidateDocs.push({
        examId: exam._id,
        employeeId: emp._id,
        examCodeId: examCode._id,
      });
    }
  }

  if (candidateDocs.length > 0) {
    await ExamCandidate.insertMany(candidateDocs, { ordered: false });
  }
}