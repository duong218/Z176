# mock-data/ — Dữ liệu GIẢ dùng khi làm việc với AI

> 🔒 Xem AGENT_RULES.md mục 1 trước khi đọc file này.

## Quy tắc

1. **Toàn bộ dữ liệu trong thư mục này là bịa (fictional)** — tên người, đơn vị, câu hỏi, đáp án đều không có thật. Không có bất kỳ liên hệ nào với nhân sự/dữ liệu thật của Z176.
2. AI (Claude, Cursor, Antigravity, Codex...) chỉ được đọc dữ liệu mẫu **từ đây** khi cần ví dụ để code/test — không bao giờ được cấp dữ liệu thật, kể cả khi Dương lỡ paste vào chat (xem AGENT_RULES.md mục 1.4).
3. Khi seed database cho môi trường dev/demo, dùng đúng các file này — không tự chế thêm trường/giá trị trùng tên thật.
4. Thư mục này **không bao giờ** được đồng bộ với dữ liệu production. Khi deploy thật, dùng script seed riêng (không có trong repo) hoặc nhập tay bởi người có thẩm quyền (AGENT_RULES.md mục 1.3).

## Danh sách file

| File | Mô tả | Tương ứng model |
|---|---|---|
| `users.mock.json` | Tài khoản mẫu (admin, examiner, leader, candidate) kèm thông tin mustChangePassword, lockedAt | `User` |
| `roles.mock.json` | 4 vai trò của hệ thống (admin, examiner, leader, candidate) | `Role` |
| `employees.mock.json` | Hồ sơ nhân viên tương ứng liên kết với User và phòng ban | `Employee` |
| `departments.mock.json` | Danh sách phòng ban chuyên môn mẫu kèm slug chuẩn hóa | `Department` |
| `topics.mock.json` | Danh sách chủ đề thi trắc nghiệm mẫu kèm mô tả và trạng thái | `Topic` |
| `questions.mock.json` | Ngân hàng câu hỏi mẫu, phân loại theo độ khó, phạm vi (Common/DepartmentSpecific) và chủ đề | `Question` |
| `answers.mock.json` | Đáp án của các câu hỏi mẫu tương ứng | `Answer` |
| `exams.mock.json` | Đề xuất kỳ thi mẫu (draft, published, cấu hình câu hỏi chung/riêng, ngưỡng đạt) | `Exam` |
| `examCodes.mock.json` | Các biến thể mã đề thi mẫu sinh cho từng cá nhân/phòng ban | `ExamCode` |
| `examCandidates.mock.json` | Danh sách thí sinh được phân mã đề tham gia kỳ thi kèm số lượt thi bổ sung | `ExamCandidate` |
| `examAttempts.mock.json` | Các lượt thi mẫu của thí sinh (in_progress, submitted, expired, autoSubmitReason) | `ExamAttempt` |
| `results.mock.json` | Kết quả thi mẫu, chấm điểm tự động gắn với lượt thi | `Result` |
| `studyDocuments.mock.json` | Danh mục tài liệu ôn tập lưu trữ máy chủ nội bộ (Common/DepartmentSpecific) | `StudyDocument` |
| `notifications.mock.json` | Danh sách thông báo in-app gửi cho người dùng | `Notification` |
| `auditLog.mock.json` | Nhật ký hệ thống mẫu ghi lại các hành động nhạy cảm và các lần bị chặn an toàn | `AuditLog` |

## Lưu ý kỹ thuật

- Mọi ID liên kết giữa các file đã được chuẩn hóa sang định dạng **ObjectId** dạng chuỗi 24 ký tự hợp lệ của MongoDB (ví dụ: `"65b9a8f1e4b0a1c2d3e4f501"`) để AI dễ dàng viết các hàm populate, aggregate, hoặc test truy vấn liên kết bảng.
- Mật khẩu mẫu trong `users.mock.json` là hash bcrypt **giả** (chuỗi placeholder), không dùng để test bcrypt.compare thật.
- Câu hỏi mẫu cố tình có nội dung vô thưởng vô phạt (kiến thức phổ thông, nội quy an toàn lao động cơ bản) — không liên quan chuyên môn quân sự/nội bộ thật.
