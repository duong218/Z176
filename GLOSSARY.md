# GLOSSARY.md — Thuật ngữ dùng thống nhất trong dự án
## Module Thi Chuyên Môn Nội Bộ — Z176
**Người thực hiện:** Phạm Ngọc Dương — VNUA | **Trạng thái:** Bản nháp chuẩn bị, chưa nhận đề tài chính thức

**Mục đích:** Các file AGENTS.md, AGENT_RULES.md, SKILLS.md, DECISIONS.md, SECURITY_BASELINE.md, LIBRARY.md dùng chung một số từ nghiệp vụ (đề thi, phiên thi, ngân hàng câu hỏi...) nhưng chưa có nơi nào định nghĩa rõ ràng. AI đọc nhiều file cùng lúc dễ suy diễn sai nghĩa hoặc đặt tên biến/model lệch nhau giữa các phần code khác nhau (vd lúc gọi `Exam`, lúc gọi `Test`, lúc gọi `Quiz` cho cùng một khái niệm). File này chốt **một tên gọi duy nhất** cho mỗi khái niệm — AI phải dùng đúng từ ở đây khi đặt tên biến, model, route, hoặc khi viết tài liệu/báo cáo.

> ⚠️ File này đứng ngang hàng bổ trợ cho SKILLS.md mục 2 (cấu trúc thư mục) và DECISIONS.md — không thay thế hai file đó. Nếu một thuật ngữ ở đây mâu thuẫn với tên đã lỡ dùng trong code, **sửa code cho khớp glossary**, không sửa glossary theo code trừ khi có lý do rõ ràng (ghi lại lý do y như ADR).

---

## 1. Thuật ngữ nghiệp vụ (domain)

| Thuật ngữ tiếng Việt | Tên gọi chuẩn trong code (English) | Định nghĩa | Ghi chú |
|---|---|---|---|
| Ngân hàng câu hỏi | `QuestionBank` | Tập hợp toàn bộ câu hỏi đã tạo, chưa gắn vào đề thi cụ thể nào. | Nguồn để sinh đề thi; xem SKILLS.md mục 2 (`models/`). |
| Câu hỏi | `Question` | Một đơn vị câu hỏi trong ngân hàng, có thể thuộc nhiều dạng (1 đáp án đúng / nhiều đáp án đúng / đúng-sai). | Field khác nhau theo dạng — lý do MongoDB được chọn (xem DECISIONS.md ADR-001). |
| Đề thi | `Exam` | Một tập câu hỏi đã được chọn/trộn theo cấu hình (`ExamConfig`) để giao cho thí sinh trong một kỳ thi cụ thể. | Không dùng `Test` hay `Quiz` — hai từ này **không được dùng** trong code/route để tránh lẫn với "unit test". |
| Cấu hình đề thi | `ExamConfig` | Bảng chứa số câu, thời gian làm bài, thang điểm, điểm liệt (nếu có) — không hardcode các giá trị này trong code (xem SKILLS.md mục 3). | |
| Phiên thi / Phiên làm bài | `ExamSession` | Một lượt cụ thể một thí sinh làm một đề thi — có thời điểm bắt đầu, thời điểm nộp/hết giờ, trạng thái (đang làm / đã nộp / hết giờ). | Khác với "session đăng nhập" (JWT session) — hai khái niệm không dùng chung tên biến. |
| Token phiên thi | `examSessionToken` (không nhầm với `accessToken`/`refreshToken` đăng nhập) | Token gắn với một `ExamSession`, phải random đủ mạnh, hủy khi nộp bài/hết giờ. | Xem SECURITY_BASELINE.md mục 2. |
| Trộn đề / trộn đáp án | `shuffleQuestions()` / `shuffleAnswers()` | Thay đổi thứ tự câu hỏi/đáp án mỗi khi sinh phiên thi mới, dùng `crypto.randomInt()`. | Không dùng `Math.random()` — nguyên tắc cứng (SKILLS.md mục 4.5, DECISIONS.md ADR-003). |
| Kết quả thi | `ExamResult` | Điểm số + chi tiết trả lời của một `ExamSession` sau khi nộp/hết giờ, dùng để thống kê/báo cáo. | Là dữ liệu nhạy cảm — không đưa dữ liệu thật vào AI tool dù chỉ là kết quả (xem AGENT_RULES.md mục 1). |
| Nhật ký hành động / Audit log | `AuditLog` | Bản ghi ai làm gì, lúc nào với hành động nhạy cảm: tạo/sửa/xóa câu hỏi, chấm điểm, xem đáp án, đổi phân quyền. | Xem SECURITY_BASELINE.md mục 3. Không nhầm với `NhatKyTienDo...xlsx` (nhật ký *tiến độ làm khóa luận* của Dương, không phải log hệ thống). |

## 2. Vai trò người dùng (role)

| Tên gọi chuẩn | Giá trị trong code (`role` field) | Quyền tóm tắt |
|---|---|---|
| Quản trị viên | `admin` | Toàn quyền: quản lý user, phân quyền, xem mọi báo cáo. |
| Người ra đề | `examiner` | Tạo/sửa câu hỏi, tạo đề thi, xem kết quả — **không** phải người thi. |
| Thí sinh | `candidate` | Làm bài thi — không có endpoint nào trả về đáp án đúng trước/trong khi thi (SECURITY_BASELINE.md mục 1). |

> Không dùng `user`/`teacher`/`student` chung chung trong code cho 3 role này — dễ nhầm với dự án LucyClass (vốn dùng `teacher`/`student`). Hai dự án là **độc lập**, không share model.

## 3. Thuật ngữ trạng thái dự án (dùng trong AGENTS.md, DECISIONS.md)

| Ký hiệu | Ý nghĩa |
|---|---|
| ✅ Đã chốt | Quyết định chính thức, không đổi trừ khi có ADR mới ghi rõ "Superseded by". |
| 🔸 Tạm chốt | Quyết định dựa trên giả định, chờ khảo sát Z176 xác nhận — AI có thể tiếp tục code trên giả định này nhưng phải nhắc Dương đây là tạm thời. |
| 🔒 Nguyên tắc cứng | Không được vi phạm dù AI hay Dương đề xuất khác — phải có ADR/thảo luận riêng mới được đổi, không tự sửa âm thầm. |
| MVP | Bản dựng tối thiểu dùng để khảo sát/demo với Z176 — không phải bản chính thức triển khai. |

## 4. Thuật ngữ kỹ thuật hay bị gọi lẫn tên

| Hay bị nhầm với | Tên chuẩn | Phân biệt |
|---|---|---|
| "token" chung chung | `accessToken` (JWT, sống ngắn) vs `refreshToken` (JWT, sống dài) vs `examSessionToken` (phiên thi) | Ba loại token khác mục đích, không dùng chung tên biến `token` trong code liên quan bảo mật. |
| "mock data" / "dữ liệu mẫu" / "dữ liệu test" | `mock-data/` (đúng quy ước thư mục — SKILLS.md mục 2) | Chỉ dùng thư mục này khi cần AI đọc ví dụ dữ liệu — không tạo thư mục tên khác (`sample-data/`, `test-data/`...) cho cùng mục đích. |
| "log" chung chung | `AuditLog` (nghiệp vụ, lưu DB) vs log hệ thống/console (kỹ thuật, không lưu câu hỏi-đáp án dạng rõ) | Xem SECURITY_BASELINE.md mục 3 — hai loại log có yêu cầu khác nhau. |

---

## Cách cập nhật file này

- Khi phát hiện một thuật ngữ mới bị gọi bằng nhiều tên khác nhau giữa các file hoặc giữa các phiên code — thêm dòng mới vào bảng phù hợp, **không đổi tên chuẩn đã chốt** trừ khi ghi rõ lý do (kiểu ADR) ngay trong ô Ghi chú.
- Nếu khảo sát chính thức với Z176 cho ra thuật ngữ nghiệp vụ khác (vd đơn vị gọi "đề thi" là "bài kiểm tra chuyên môn") — cập nhật cột "Thuật ngữ tiếng Việt" cho khớp thực tế, giữ nguyên tên code chuẩn nếu không ảnh hưởng.
- AI khi đọc AGENTS.md (mục 1 — thứ tự đọc bắt buộc) nên tra file này song song với LIBRARY.md để đặt tên đúng ngay từ đầu, tránh phải refactor lại sau.

---
*File này bổ sung sau khảo sát chính thức nếu Z176 dùng thuật ngữ nghiệp vụ khác với giả định hiện tại.*
