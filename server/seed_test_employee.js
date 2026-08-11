// ============================================================
// SCRIPT TẠO DỮ LIỆU MẪU ĐỂ TEST CANDIDATE DASHBOARD
// Chạy trong mongosh, kết nối đúng database của bạn trước:
//   mongosh "mongodb://localhost:27017/ten_database_cua_ban"
// Rồi copy-paste toàn bộ đoạn dưới vào, hoặc load file này:
//   mongosh "mongodb://localhost:27017/ten_database_cua_ban" seed_test_employee.js
// ============================================================

// ---- BƯỚC 1: Tìm user "nhanvien" đã tạo ----
const user = db.users.findOne({ username: "nhanvien" });
if (!user) {
  print("❌ Không tìm thấy user 'nhanvien'. Kiểm tra lại username.");
  quit();
}
print("✅ Tìm thấy user: " + user._id);

// ---- BƯỚC 2: Lấy 1 department có sẵn, nếu chưa có thì tạo tạm ----
let department = db.departments.findOne();
if (!department) {
  const deptResult = db.departments.insertOne({
    name: "Phòng Kỹ thuật",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  department = db.departments.findOne({ _id: deptResult.insertedId });
  print("✅ Chưa có department nào, đã tạo tạm: " + department.name);
} else {
  print("✅ Dùng department có sẵn: " + department.name);
}

// ---- BƯỚC 3: Tạo Employee gắn với user (nếu chưa có) ----
let employee = db.employees.findOne({ userId: user._id });
if (!employee) {
  const empResult = db.employees.insertOne({
    fullname: "Nguyễn Văn Test",
    departmentId: department._id,
    userId: user._id,
    employeeCode: "NV-TEST-001",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  employee = db.employees.findOne({ _id: empResult.insertedId });
  print("✅ Đã tạo Employee: " + employee.fullname);
} else {
  print("ℹ️  Employee đã tồn tại sẵn, bỏ qua bước tạo.");
}

// ---- BƯỚC 4: Lấy 1 topic + tạo Exam mẫu (nếu chưa có exam nào) ----
let topic = db.topics.findOne();
if (!topic) {
  const topicResult = db.topics.insertOne({
    name: "An toàn lao động cơ bản",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  topic = db.topics.findOne({ _id: topicResult.insertedId });
  print("✅ Chưa có topic nào, đã tạo tạm: " + topic.name);
}

let exam = db.exams.findOne({ title: "Bài thi mẫu (test dashboard)" });
if (!exam) {
  const examResult = db.exams.insertOne({
    title: "Bài thi mẫu (test dashboard)",
    topicId: topic._id,
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // hôm qua
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),   // ngày mai
    durationMinutes: 20,
    totalQuestions: 10,
    commonQuestionCount: 10,
    departmentQuestionCount: 0,
    status: "published",
    passThresholdPercent: 70,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  exam = db.exams.findOne({ _id: examResult.insertedId });
  print("✅ Đã tạo Exam mẫu: " + exam.title);
}

// ---- BƯỚC 5: Tạo ExamCode mẫu (bắt buộc theo schema exam-candidate) ----
let examCode = db.examcodes.findOne({ examId: exam._id, code: "DE-TEST-01" });
if (!examCode) {
  const codeResult = db.examcodes.insertOne({
    examId: exam._id,
    code: "DE-TEST-01",
    departmentId: department._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  examCode = db.examcodes.findOne({ _id: codeResult.insertedId });
  print("✅ Đã tạo ExamCode mẫu: " + examCode.code);
}

// ---- BƯỚC 6: Tạo ExamCandidate (liên kết employee với exam) ----
let examCandidate = db.examcandidates.findOne({ examId: exam._id, employeeId: employee._id });
if (!examCandidate) {
  const candResult = db.examcandidates.insertOne({
    examId: exam._id,
    employeeId: employee._id,
    examCodeId: examCode._id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  examCandidate = db.examcandidates.findOne({ _id: candResult.insertedId });
  print("✅ Đã tạo ExamCandidate.");
}

// ---- BƯỚC 7: Tạo 2 lượt thi (ExamAttempt) mẫu — 1 đạt, 1 chưa đạt ----
function createAttemptWithResult(attemptType, score, correctCount, totalQuestions, passed, daysAgo) {
  const submittedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const startedAt = new Date(submittedAt.getTime() - 15 * 60 * 1000);

  const attemptResult = db.examattempts.insertOne({
    examCandidateId: examCandidate._id,
    attemptType: attemptType,
    startedAt: startedAt,
    submittedAt: submittedAt,
    status: "submitted",
    createdAt: startedAt,
    updatedAt: submittedAt,
  });

  db.results.insertOne({
    examAttemptId: attemptResult.insertedId,
    score: score,
    correctCount: correctCount,
    totalQuestions: totalQuestions,
    passed: passed,
    createdAt: submittedAt,
    updatedAt: submittedAt,
  });

  print("✅ Đã tạo lượt thi '" + attemptType + "' — điểm " + score + ", " + (passed ? "ĐẠT" : "CHƯA ĐẠT"));
}

// Lượt 1: cách đây 3 ngày, chưa đạt
createAttemptWithResult("first", 60, 6, 10, false, 3);
// Lượt 2: cách đây 1 ngày, đạt
createAttemptWithResult("retake", 80, 8, 10, true, 1);

print("");
print("🎉 XONG! Đăng nhập lại tài khoản 'nhanvien' và vào Dashboard để xem kết quả.");