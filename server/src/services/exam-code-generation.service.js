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
import { notificationService } from './notification.service.js';

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

// ĐỔI — mỗi thí sinh giờ có bộ câu RIÊNG (random độc lập, không dùng chung cả
// phòng ban nữa — xem generateExamCodesAndAssignCandidates bên dưới), nên mã
// đề cũng phải là CỦA RIÊNG từng người để không đụng unique index {examId,
// code}. Ưu tiên employeeCode (dễ đọc/đối chiếu khi có khiếu nại), luôn cộng
// thêm hậu tố ngẫu nhiên ngắn để tuyệt đối không trùng dù 2 nhân viên hiếm
// khi nào đó có employeeCode giống nhau hoặc đều trống.
function buildExamCode(exam, department, employee) {
  const deptSuffix = (department.code || department.name).replace(/\s+/g, '').toUpperCase().slice(0, 8);
  const empSuffix = (employee.employeeCode || 'NV').replace(/\s+/g, '').toUpperCase().slice(0, 8);
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${exam._id.toString().slice(-6).toUpperCase()}-${deptSuffix}-${empSuffix}-${randomSuffix}`;
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

/**
 * ĐỔI — Tạo ExamCode + ExamCodeQuestion RIÊNG cho 1 NHÂN VIÊN cụ thể (không
 * còn dùng chung cho cả phòng ban). Mỗi lần gọi tự pickRandom() độc lập từ 2
 * pool (chung + riêng phòng ban) truyền vào — nên dù nhiều nhân viên cùng
 * phòng ban gọi hàm này, mỗi người vẫn ra 1 bộ câu khác nhau (ngẫu nhiên),
 * đúng tinh thần "mỗi người 1 đề riêng" thay vì "cả phòng ban chung 1 đề".
 * plan.commonPickCount / plan.deptPickCount giữ nguyên ý nghĩa như cũ —
 * chỉ số LƯỢNG câu cần lấy từ mỗi pool, không đổi.
 */
async function createExamCodeForEmployee(exam, department, employee, commonQuestions, deptQuestions, plan) {
  const commonPick = pickRandom(commonQuestions, plan.commonPickCount);
  const deptPick = pickRandom(deptQuestions, plan.deptPickCount);
  const allQuestions = shuffle([...commonPick, ...deptPick]);

  const examCode = await ExamCode.create({
    examId: exam._id,
    code: buildExamCode(exam, department, employee),
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
 * ĐỔI — Luôn TẠO MỚI mã đề riêng cho nhân viên này (không còn "tìm mã đề đã
 * có của phòng ban rồi dùng chung" như bản cũ — vì giờ không còn khái niệm
 * "mã đề chung của phòng ban" nữa). Có retry 1 lần nếu hi hữu trùng `code`
 * (lỗi 11000) — buildExamCode() đã có hậu tố ngẫu nhiên nên xác suất trùng
 * cực thấp, nhưng vẫn phòng hờ để không làm gãy cả luồng publish/gán nhân
 * viên chỉ vì 1 lần trùng ngẫu nhiên hiếm gặp.
 */
async function ensureExamCodeForEmployee(exam, department, employee, precomputedPool) {
  const { commonQuestions, deptQuestions, plan } =
    precomputedPool ?? (await validateQuestionAvailability(exam, department));

  try {
    return await createExamCodeForEmployee(exam, department, employee, commonQuestions, deptQuestions, plan);
  } catch (err) {
    if (err?.code === 11000) {
      return createExamCodeForEmployee(exam, department, employee, commonQuestions, deptQuestions, plan);
    }
    throw err;
  }
}

/**
 * Sinh mã đề cho TỪNG phòng ban đang có nhân viên active, rồi gán toàn bộ
 * nhân viên active của phòng ban đó vào đúng mã đề. Chạy khi kỳ thi được
 * Publish. Kiểm tra đủ câu hỏi cho TẤT CẢ phòng ban trước khi tạo bất kỳ mã
 * đề nào — thiếu ở bất kỳ đâu sẽ chặn hẳn (không publish dở dang).
 *
 * ĐỔI — Mỗi NHÂN VIÊN giờ có 1 bộ câu RIÊNG (random độc lập từ pool chung +
 * riêng của phòng ban mình), KHÔNG còn dùng chung 1 mã đề cho cả phòng ban
 * như bản cũ — tránh việc cả phòng ban thấy y hệt nhau (dễ nhìn/đọc bài
 * chéo), đổi lại chấp nhận đánh đổi: độ khó giữa các thí sinh có thể không
 * đều tuyệt đối vì random thuần, không cân theo độ khó câu hỏi.
 *
 * Việc validate pool đủ câu vẫn tính 1 LẦN theo PHÒNG BAN (không nhân theo số
 * nhân viên) — vì mỗi nhân viên chỉ RÚT ngẫu nhiên từ pool dùng chung, không
 * chia bài loại trừ lẫn nhau, nên pool chỉ cần đủ đúng plan.commonPickCount /
 * plan.deptPickCount là đủ cho MỌI nhân viên trong phòng ban, bất kể đông
 * hay ít người.
 *
 * IDEMPOTENT THEO TỪNG NHÂN VIÊN: nếu lần publish trước bị lỗi giữa chừng,
 * gọi lại hàm này chỉ tạo bổ sung đúng phần còn thiếu (nhân viên chưa có
 * ExamCandidate), không tạo trùng, không bỏ sót ai — nhờ check
 * alreadyAssignedIds bên dưới trước khi random+tạo mã đề cho từng người.
 */
export async function generateExamCodesAndAssignCandidates(exam) {
  const employees = await Employee.find({ isActive: true }).select('_id employeeCode departmentId');
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

  // Validate đủ câu hỏi cho TỪNG PHÒNG BAN trước (fail-fast) — 1 lần duy nhất
  // mỗi phòng ban, dùng lại cho mọi nhân viên của phòng ban đó (xem giải
  // thích ở JSDoc phía trên).
  const pools = new Map();
  for (const dept of departments) {
    const { commonQuestions, deptQuestions, plan } = await validateQuestionAvailability(exam, dept);
    pools.set(dept._id.toString(), { commonQuestions, deptQuestions, plan });
  }

  for (const dept of departments) {
    const deptKey = dept._id.toString();
    const deptEmployees = employeesByDept.get(deptKey) || [];
    if (deptEmployees.length === 0) continue;

    // Chỉ tạo đề + gán cho những nhân viên CHƯA có ExamCandidate cho kỳ thi
    // này — an toàn khi hàm này được gọi lại nhiều lần do lần publish trước
    // bị lỗi giữa chừng.
    const existingCandidates = await ExamCandidate.find({
      examId: exam._id,
      employeeId: { $in: deptEmployees.map((e) => e._id) },
    }).select('employeeId');
    const alreadyAssignedIds = new Set(existingCandidates.map((c) => c.employeeId.toString()));

    const pendingEmployees = deptEmployees.filter((emp) => !alreadyAssignedIds.has(emp._id.toString()));
    if (pendingEmployees.length === 0) continue;

    const pool = pools.get(deptKey);

    // Tạo tuần tự từng nhân viên (không insertMany hàng loạt như bản cũ) vì
    // mỗi người giờ cần 1 ExamCode RIÊNG (random riêng) trước khi có thể tạo
    // ExamCandidate trỏ tới đúng examCodeId của người đó.
    for (const employee of pendingEmployees) {
      const examCode = await ensureExamCodeForEmployee(exam, dept, employee, pool);
      await ExamCandidate.create({
        examId: exam._id,
        employeeId: employee._id,
        examCodeId: examCode._id,
      });
    }
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
  let exam;
  let department;
  try {
    exam = await Exam.findOne({ status: EXAM_STATUS.PUBLISHED });
    if (!exam) return null;

    const alreadyAssigned = await ExamCandidate.findOne({ examId: exam._id, employeeId: employee._id });
    if (alreadyAssigned) return alreadyAssigned;

    department = await Department.findById(employee.departmentId);
    if (!department || !department.isActive) return null;

    const examCode = await ensureExamCodeForEmployee(exam, department, employee);

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

    // MỚI — báo cho Examiner đã tạo kỳ thi + mọi Admin biết nhân viên này
    // CHƯA được gán đề (thường do ngân hàng câu hỏi không đủ cho phòng ban
    // của họ), thay vì chỉ console.error âm thầm — không ai trên giao diện
    // biết được cho tới khi chính nhân viên phàn nàn không thi được. Không
    // throw ra ngoài — đây không phải điều kiện bắt buộc để tạo tài khoản
    // nhân viên, và lỗi khi GỬI thông báo cũng không được làm hỏng luồng
    // tạo nhân viên chính (catch lồng riêng bên dưới).
    if (exam) {
      try {
        await notificationService.notifyExamAssignmentFailed({
          exam,
          employee,
          department,
          reason: err.message,
        });
      } catch (notifyErr) {
        // eslint-disable-next-line no-console
        console.error('notifyExamAssignmentFailed failed:', notifyErr);
      }
    }

    return null;
  }
}