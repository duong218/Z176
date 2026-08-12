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
 * Kiểm tra & tính TOÁN PHƯƠNG ÁN lấy câu hỏi (chung + riêng phòng ban) cho 1
 * phòng ban. Không còn cứng nhắc theo đúng commonQuestionCount/
 * departmentQuestionCount như trước — nếu câu RIÊNG không đủ, phần thiếu
 * (shortfall) sẽ được BÙ THÊM từ pool câu CHUNG (cộng dồn vào số lượng lấy
 * từ pool chung, không đổi cấu trúc field của Exam). Chỉ ném lỗi chặn hẳn
 * khi TỔNG 2 pool (chung + riêng phòng ban) vẫn không đủ tổng số câu cần
 * (commonQuestionCount + departmentQuestionCount) — tức là kể cả bù cũng
 * không đủ, để đảm bảo KHÔNG có thí sinh nào bị thiếu đề/không được gán đề.
 *
 * Trả về pool câu hỏi kèm "plan" (số lượng thực tế sẽ lấy từ mỗi pool) để
 * bước tạo mã đề dùng lại, tránh phải tính lại.
 */
async function validateQuestionAvailability(exam, department) {
  const commonQuestions = await Question.find({
    topicId: exam.topicId,
    scope: QUESTION_SCOPE.COMMON,
    isActive: true,
  });

  const deptQuestions = await Question.find({
    topicId: exam.topicId,
    scope: QUESTION_SCOPE.DEPARTMENT_SPECIFIC,
    departmentId: department._id,
    isActive: true,
  });

  const totalNeeded = exam.commonQuestionCount + exam.departmentQuestionCount;
  const deptPickCount = Math.min(deptQuestions.length, exam.departmentQuestionCount);
  const shortfall = exam.departmentQuestionCount - deptPickCount;
  // Số câu cần lấy từ pool chung = số câu chung gốc + phần bù do thiếu câu riêng
  const commonPickCount = exam.commonQuestionCount + shortfall;

  if (commonQuestions.length < commonPickCount) {
    // Kể cả đã bù hết mức có thể từ pool riêng vẫn không đủ tổng số câu cần.
    const totalAvailable = commonQuestions.length + deptQuestions.length;
    throw new ApiError(
      400,
      `Phòng ban "${department.name}" không đủ câu hỏi để tạo đề (cần tổng ${totalNeeded} câu, ` +
        `hiện có ${commonQuestions.length} câu chung + ${deptQuestions.length} câu riêng = ${totalAvailable} câu). ` +
        `Vui lòng bổ sung thêm câu hỏi (chung hoặc riêng cho phòng ban này) thuộc chủ đề đã chọn.`,
      'INSUFFICIENT_QUESTIONS',
    );
  }

  return {
    commonQuestions,
    deptQuestions,
    plan: { commonPickCount, deptPickCount, shortfall },
  };
}

/** Tạo ExamCode + ExamCodeQuestion cho 1 phòng ban từ 2 pool đã kiểm tra đủ, theo đúng plan đã tính (có thể đã bù thêm từ pool chung nếu thiếu câu riêng). */
async function createExamCodeForDepartment(exam, department, commonQuestions, deptQuestions, plan) {
  const commonPick = pickRandom(commonQuestions, plan.commonPickCount);
  const deptPick = pickRandom(deptQuestions, plan.deptPickCount);
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

  const { commonQuestions, deptQuestions, plan } = await validateQuestionAvailability(exam, department);

  try {
    return await createExamCodeForDepartment(exam, department, commonQuestions, deptQuestions, plan);
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

  // Validate hết trước (fail-fast), giữ nguyên pool + plan đã tính để tạo ở bước sau.
  const pools = new Map();
  for (const dept of departments) {
    const { commonQuestions, deptQuestions, plan } = await validateQuestionAvailability(exam, dept);
    pools.set(dept._id.toString(), { commonQuestions, deptQuestions, plan });
  }

  const candidateDocs = [];
  for (const dept of departments) {
    const { commonQuestions, deptQuestions, plan } = pools.get(dept._id.toString());
    const examCode = await createExamCodeForDepartment(exam, dept, commonQuestions, deptQuestions, plan);

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