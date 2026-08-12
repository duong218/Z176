import crypto from 'node:crypto';
import {
  Department,
  Employee,
  Question,
  ExamCode,
  ExamCodeQuestion,
  ExamCandidate,
  Exam,
  EXAM_STATUS,
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

function buildExamCode(exam, department) {
  const codeSuffix = (department.code || department.name).replace(/\s+/g, '').toUpperCase().slice(0, 10);
  return `${exam._id.toString().slice(-6).toUpperCase()}-${codeSuffix}`;
}

/**
 * Kiểm tra đủ câu hỏi (chung + riêng phòng ban) cho 1 phòng ban theo đúng
 * commonQuestionCount/departmentQuestionCount của Exam. Ném lỗi rõ ràng nếu
 * thiếu, trả về 2 pool câu hỏi nếu đủ (để tái sử dụng, tránh query lại).
 */
async function validateQuestionAvailability(exam, department) {
  const commonQuestions = await Question.find({
    topicId: exam.topicId,
    scope: QUESTION_SCOPE.COMMON,
    isActive: true,
  });
  if (commonQuestions.length < exam.commonQuestionCount) {
    throw new ApiError(
      400,
      `Ngân hàng câu hỏi chung của chủ đề không đủ: cần ${exam.commonQuestionCount} câu, hiện chỉ có ${commonQuestions.length} câu.`,
      'INSUFFICIENT_COMMON_QUESTIONS',
    );
  }

  const deptQuestions = await Question.find({
    topicId: exam.topicId,
    scope: QUESTION_SCOPE.DEPARTMENT_SPECIFIC,
    departmentId: department._id,
    isActive: true,
  });
  if (deptQuestions.length < exam.departmentQuestionCount) {
    throw new ApiError(
      400,
      `Phòng ban "${department.name}" không đủ câu hỏi riêng: cần ${exam.departmentQuestionCount} câu, hiện chỉ có ${deptQuestions.length} câu.`,
      'INSUFFICIENT_DEPARTMENT_QUESTIONS',
    );
  }

  return { commonQuestions, deptQuestions };
}

/** Tạo ExamCode + ExamCodeQuestion cho 1 phòng ban từ 2 pool đã kiểm tra đủ. */
async function createExamCodeForDepartment(exam, department, commonQuestions, deptQuestions) {
  const commonPick = pickRandom(commonQuestions, exam.commonQuestionCount);
  const deptPick = pickRandom(deptQuestions, exam.departmentQuestionCount);
  const allQuestions = shuffle([...commonPick, ...deptPick]);

  const examCode = await ExamCode.create({
    examId: exam._id,
    code: buildExamCode(exam, department),
    departmentId: department._id,
    questionSetFingerprint: computeFingerprint(allQuestions.map((q) => q._id)),
  });

  const examCodeQuestionDocs = allQuestions.map((q, index) => ({
    examCodeId: examCode._id,
    questionId: q._id,
    orderIndex: index,
  }));
  await ExamCodeQuestion.insertMany(examCodeQuestionDocs);

  return examCode;
}

/**
 * Đảm bảo có ExamCode cho (exam, department) — trả về mã đề đã có sẵn nếu
 * tồn tại, hoặc tạo mới nếu chưa. Dùng cho trường hợp gán đề cho 1 nhân viên
 * đơn lẻ (vd nhân viên mới tạo sau khi kỳ thi đã publish, hoặc phòng ban lúc
 * publish chưa có ai nên chưa được sinh mã đề).
 */
async function ensureExamCodeForDepartment(exam, department) {
  const existing = await ExamCode.findOne({ examId: exam._id, departmentId: department._id });
  if (existing) return existing;

  const { commonQuestions, deptQuestions } = await validateQuestionAvailability(exam, department);

  try {
    return await createExamCodeForDepartment(exam, department, commonQuestions, deptQuestions);
  } catch (err) {
    // Trường hợp đụng độ hiếm gặp: 2 request tạo nhân viên cùng phòng ban chạy
    // song song, cả 2 cùng thấy "chưa có mã đề" rồi cùng tạo -> vi phạm unique
    // index {examId, code}. Khi đó lấy lại mã đề mà request kia vừa tạo thành công.
    if (err?.code === 11000) {
      const raceExisting = await ExamCode.findOne({ examId: exam._id, departmentId: department._id });
      if (raceExisting) return raceExisting;
    }
    throw err;
  }
}

/**
 * Sinh mã đề cho TỪNG phòng ban đang có nhân viên active, rồi gán toàn bộ
 * nhân viên active của phòng ban đó vào đúng mã đề. Chạy 1 lần khi kỳ thi
 * được Publish. Kiểm tra đủ câu hỏi cho TẤT CẢ phòng ban trước khi tạo bất kỳ
 * mã đề nào — thiếu ở bất kỳ đâu sẽ chặn hẳn (không publish dở dang).
 */
export async function generateExamCodesAndAssignCandidates(exam) {
  const existingCodesCount = await ExamCode.countDocuments({ examId: exam._id });
  if (existingCodesCount > 0) {
    return; // đã sinh mã đề cho kỳ thi này rồi (vd gọi lại do retry)
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

  // Validate hết trước (fail-fast), giữ nguyên pool đã query để tạo ở bước sau.
  const pools = new Map();
  for (const dept of departments) {
    const { commonQuestions, deptQuestions } = await validateQuestionAvailability(exam, dept);
    pools.set(dept._id.toString(), { commonQuestions, deptQuestions });
  }

  const candidateDocs = [];
  for (const dept of departments) {
    const { commonQuestions, deptQuestions } = pools.get(dept._id.toString());
    const examCode = await createExamCodeForDepartment(exam, dept, commonQuestions, deptQuestions);

    const deptEmployees = employeesByDept.get(dept._id.toString()) || [];
    for (const emp of deptEmployees) {
      candidateDocs.push({ examId: exam._id, employeeId: emp._id, examCodeId: examCode._id });
    }
  }

  if (candidateDocs.length > 0) {
    await ExamCandidate.insertMany(candidateDocs, { ordered: false });
  }
}

/**
 * Gán 1 nhân viên (thường là vừa tạo tài khoản) vào kỳ thi đang published,
 * nếu có. Tạo mã đề cho phòng ban của nhân viên nếu chưa có (vd phòng ban mới
 * hoặc lúc publish phòng ban đó chưa có ai). Không ném lỗi ra ngoài — nếu gán
 * thất bại (vd ngân hàng câu hỏi thiếu), CHỈ log cảnh báo, không chặn việc tạo
 * tài khoản (đây không phải điều kiện bắt buộc để tạo user).
 */
export async function assignEmployeeToActiveExamIfAny(employee) {
  try {
    const exam = await Exam.findOne({ status: EXAM_STATUS.PUBLISHED });
    if (!exam) return null;

    const alreadyAssigned = await ExamCandidate.findOne({ examId: exam._id, employeeId: employee._id });
    if (alreadyAssigned) return alreadyAssigned;

    const department = await Department.findById(employee.departmentId);
    if (!department || !department.isActive) return null;

    const examCode = await ensureExamCodeForDepartment(exam, department);

    return await ExamCandidate.create({
      examId: exam._id,
      employeeId: employee._id,
      examCodeId: examCode._id,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[exam-code-generation] Không thể tự động gán đề thi cho nhân viên ${employee._id}: ${err.message}`,
    );
    return null;
  }
}