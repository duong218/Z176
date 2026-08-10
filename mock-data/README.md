# mock-data/ — Dữ liệu GIẢ dùng khi làm việc với AI

> 🔒 Xem AGENT_RULES.md mục 1 trước khi đọc file này.

## Quy tắc

1. **Toàn bộ dữ liệu trong thư mục này là bịa (fictional)** — tên người, đơn vị, câu hỏi, đáp án đều không có thật. Không có bất kỳ liên hệ nào với nhân sự/dữ liệu thật của Z176.
2. AI (Claude, Cursor, Antigravity, Codex...) chỉ được đọc dữ liệu mẫu **từ đây** khi cần ví dụ để code/test — không bao giờ được cấp dữ liệu thật, kể cả khi Dương lỡ paste vào chat (xem AGENT_RULES.md mục 1.4).
3. Khi seed database cho môi trường dev/demo, dùng đúng các file này (`npm run seed` sẽ đọc từ `mock-data/`) — không tự chế thêm trường/giá trị trùng tên thật.
4. Nếu cần thêm loại dữ liệu mẫu mới (vd thêm nhóm câu hỏi, thêm role) — thêm file mới vào đây theo đúng convention đặt tên `<tên-collection>.mock.json`, không sửa trực tiếp vào code seed.
5. Thư mục này **không bao giờ** được đồng bộ với dữ liệu production. Khi deploy thật, dùng script seed riêng (không có trong repo) hoặc nhập tay bởi người có thẩm quyền (AGENT_RULES.md mục 1.3).

## Danh sách file

| File | Mô tả | Tương ứng model (dự kiến) |
|---|---|---|
| `users.mock.json` | 6 tài khoản mẫu, đủ 3 role: Admin / Người ra đề / Thí sinh | `User` |
| `examConfig.mock.json` | Cấu hình đề thi mẫu (số câu, thời gian, điểm liệt) — theo nguyên tắc "không magic number" trong SKILLS.md | `ExamConfig` |
| `questions.mock.json` | Ngân hàng câu hỏi mẫu, nhiều dạng (trắc nghiệm 1 đáp án, nhiều đáp án, đúng/sai) | `Question` |
| `exams.mock.json` | Đề thi mẫu, tham chiếu tới `questions.mock.json` | `Exam` |
| `examSessions.mock.json` | Phiên làm bài mẫu (đang làm / đã nộp / bị ngắt kết nối giữa chừng) | `ExamSession` |
| `results.mock.json` | Kết quả thi mẫu, gắn với `examSessions.mock.json` | `Result` |
| `auditLog.mock.json` | Log audit mẫu cho hành động nhạy cảm (theo SECURITY_BASELINE.md mục 3) | `AuditLog` |

## Lưu ý kỹ thuật

- ID dùng dạng chuỗi giả `"u_001"`, `"q_001"`... không dùng ObjectId thật để tránh nhầm với dữ liệu seed thật khi debug.
- Mật khẩu mẫu trong `users.mock.json` là hash bcrypt **giả** (chuỗi placeholder), không phải hash thật của mật khẩu nào — không dùng để test bcrypt.compare thật, chỉ để test shape dữ liệu.
- Câu hỏi mẫu cố tình có nội dung vô thưởng vô phạt (kiến thức phổ thông) — không liên quan chuyên môn quân sự/nội bộ thật.
