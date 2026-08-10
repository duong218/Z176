# SYNC_PROTOCOL.md — Quy trình đồng bộ cập nhật hệ thống file sau khảo sát
## Module Thi Chuyên Môn Nội Bộ — Z176
**Người thực hiện:** Phạm Ngọc Dương — VNUA | **Trạng thái:** Chờ kích hoạt (chưa nhận đề tài chính thức, chưa khảo sát)

**Mục đích:** Hiện tại nhiều file (SKILLS.md, DECISIONS.md, SECURITY_BASELINE.md, AGENTS.md...) đang chứa hàng loạt giả định tạm 🔸 chờ câu trả lời khảo sát (`KhaoSat_MVP_KhoaLuan_PhamNgocDuong.xlsx`, cột "Trả lời"). Rủi ro: khi khảo sát xong và cột trả lời được điền, rất dễ chỉ sửa 1-2 file rồi quên các file còn lại → hệ thống rule bị lệch nhau, AI đọc file cũ vẫn code theo giả định đã sai. File này là **kịch bản chạy một lần (và lặp lại nếu khảo sát bổ sung sau)** để đảm bảo mọi file được rà soát và cập nhật đồng bộ, không sót.

> ⚠️ File này chỉ **kích hoạt** khi cả 2 điều kiện đúng: (1) đã có quyết định giao đề tài chính thức từ GVHD/khoa, (2) cột "Trả lời" trong `KhaoSat_MVP_KhoaLuan_PhamNgocDuong.xlsx` đã được điền cho ít nhất các câu 🔴 Bắt buộc. Trước khi cả 2 điều kiện đúng — bỏ qua file này, coi mọi giả định 🔸 hiện tại là hiện trạng làm việc bình thường (xem AGENTS.md mục 0).

---

## 0. Bước 0 — Kiểm tra an toàn dữ liệu trước khi đọc câu trả lời khảo sát

Trước khi AI đọc cột "Trả lời" vừa điền, luôn chạy qua bước này trước (không bỏ qua dù Dương có vẻ vội):

1. Cột "Trả lời" của khảo sát này là **thông tin nghiệp vụ/quy trình** (vd hình thức thi, số lượng thí sinh, framework CNTT yêu cầu) — về nguyên tắc không phải "dữ liệu thật" theo nghĩa cấm ở AGENT_RULES.md mục 1 (vốn nói về *tên nhân viên thật, câu hỏi thi thật, đáp án thật, kết quả thi thật*).
2. Tuy nhiên nếu câu trả lời vô tình chứa thông tin định danh cụ thể (tên người trả lời kèm chức vụ nhạy cảm, tên hệ thống nội bộ kèm thông tin cấu hình bảo mật thật, số liệu được đánh dấu mật...) → dừng lại, hỏi Dương xác nhận có nên xử lý tiếp không, không tự suy đoán là "chắc không sao".
3. Cột "Người trả lời" trong file khảo sát — nếu có ghi tên thật kèm chức vụ, AI khi trích dẫn lại vào các file .md khác **chỉ ghi vai trò** (vd "theo xác nhận của Ban CNTT Z176"), không chép nguyên tên người vào file rule/tài liệu kỹ thuật.

---

## 1. Bảng ánh xạ: Câu hỏi khảo sát → File/mục cần rà soát

| STT khảo sát | Chủ đề | File cần rà soát | Mục cụ thể | Hành động khi có câu trả lời |
|---|---|---|---|---|
| #6, #7 | Quy trình duyệt kỳ thi, mức nhạy cảm kết quả | SECURITY_BASELINE.md | Mục 1 (RBAC), mục 3 (Audit log) | Nếu kết quả ảnh hưởng lương/thưởng → nâng yêu cầu audit log, thêm checklist nếu cần. |
| #8, #10 | Nơi lưu câu hỏi hiện tại, phân loại độ khó | SKILLS.md, DECISIONS.md | Mục 2 (cấu trúc), ADR-001 (schema MongoDB) | Xác nhận hoặc điều chỉnh field trong `Question` — có thể cần ADR mới nếu cấu trúc phức tạp hơn giả định. |
| #9 | Ai được tạo/sửa/duyệt câu hỏi | GLOSSARY.md, SECURITY_BASELINE.md | Mục 2 (vai trò), mục 1 (RBAC) | Xác nhận 3 role đã đủ hay cần thêm role "Người duyệt đề" riêng — nếu cần, thêm dòng mới vào bảng vai trò GLOSSARY.md. |
| #11, #12 | Cách sinh đề, số câu/thời gian/điểm liệt | SKILLS.md | Mục 3 (`ExamConfig`, không magic number) | Điền giá trị mặc định thật cho `ExamConfig` thay vì để trống/giả định. |
| #13 | Bảo mật đề thi trước ngày thi | AGENT_RULES.md, SECURITY_BASELINE.md | Mục "còn để mở" ở cả 2 file | Bổ sung rule cụ thể (vd mã hóa đề ở trạng thái nghỉ — encryption at rest) nếu câu trả lời yêu cầu cao hơn giả định hiện tại. |
| #21 | Quy mô người dùng dự kiến | SKILLS.md, LIBRARY.md | Mục 1 (stack), mục 8 (tối ưu hiệu năng) | Nếu quy mô lớn hơn ước tính (200-500) → cân nhắc lại chiến lược tối ưu query/cache. |
| #22 | Danh sách vai trò thật | GLOSSARY.md | Mục 2 (vai trò) | Đổi/thêm role cho khớp thực tế đơn vị (vd nếu Z176 có thêm vai trò "Trưởng phòng xem báo cáo"). |
| #23 | Nguồn dữ liệu nhân viên, có HR API không | DECISIONS.md, SECURITY_BASELINE.md | ADR mới (tự quản lý user vs đồng bộ HR), mục 4 (third-party) | Nếu có HR API → cần ADR mới + thêm rule vào mục 4 (SDK bên thứ 3 phải xác nhận Ban CNTT trước khi tích hợp). |
| #26 | On-premise vs cloud | SKILLS.md, DECISIONS.md, SECURITY_BASELINE.md, LIBRARY.md | Mục 1 (deploy), ADR-001 (khả năng đổi PostgreSQL), mục 6 (hạ tầng), mục 8 (skill deploy) | Xóa nhánh giả định không dùng (vd nếu chốt on-premise → bỏ phần Render/Vercel khỏi luồng chính, giữ lại chỉ cho demo). |
| #28 | Framework/ngôn ngữ bắt buộc | SKILLS.md, LIBRARY.md, env.example | Toàn bộ mục 1 SKILLS.md, các nhóm skill FE/BE/DB trong LIBRARY.md, biến môi trường liên quan DB/framework | Nếu Z176 yêu cầu stack khác MERN → viết lại gần như toàn bộ mục 1 SKILLS.md, cập nhật ADR-001 (Superseded by ADR mới), đổi skill tương ứng trong LIBRARY.md. |
| #29 | Mạng nội bộ có ổn định không | SECURITY_BASELINE.md, LIBRARY.md | Mục 6 (hạ tầng), mục 8 (đo performance) | Nếu mạng không ổn định → thêm yêu cầu offline-first/auto-save vào SKILLS.md mục 1, liên kết với #31/#32. |
| #30 | Ai maintain sau khóa luận | LIBRARY.md, DECISIONS.md | Mục 10 (docs/báo cáo) | Điều chỉnh mức độ chi tiết tài liệu bàn giao cần viết. |
| #31, #32 | Mất mạng/đăng xuất giữa chừng | SECURITY_BASELINE.md, GLOSSARY.md | Mục 1 (session), định nghĩa `ExamSession` | Xác nhận cơ chế auto-save/resume — cập nhật mô tả `ExamSession` trong GLOSSARY.md nếu có trạng thái mới (vd "tạm dừng"). |
| #34 | Xử lý nghi vấn gian lận/điểm bất thường | SECURITY_BASELINE.md | Mục 3 (Audit log) | Bổ sung hành động cần log nếu quy trình xử lý gian lận yêu cầu chi tiết hơn giả định. |
| #35 | Lộ ngân hàng câu hỏi trước kỳ thi | AGENT_RULES.md, SECURITY_BASELINE.md | Mục "còn để mở" ở cả 2 file | Cập nhật rule mã hóa/kiểm soát quyền đọc `QuestionBank` nếu đơn vị có quy trình xử lý sự cố riêng. |

> Các câu 1-5, 14-20, 24-25, 27, 33 chủ yếu ảnh hưởng đặc tả nghiệp vụ (tài liệu khóa luận, use case) hơn là các file rule — không bắt buộc phải sửa file .md nào ngay, nhưng nên đối chiếu khi viết Use Case (xem LIBRARY.md mục 1). Nhóm câu 36-42 (⏸ để sau) không kích hoạt bước nào trong file này cho tới khi được mở lại.

---

## 2. Quy trình 9 bước khi kích hoạt

Khi cả 2 điều kiện kích hoạt (mục đầu file) đã đúng, AI chạy tuần tự — không nhảy cóc, không tự gộp bước để "làm nhanh":

1. **Rà an toàn dữ liệu** — chạy mục 0 ở trên trước tiên.
2. **Đọc toàn bộ câu trả lời mới** trong `KhaoSat_MVP_KhoaLuan_PhamNgocDuong.xlsx` (chỉ cột đã điền, nhóm 🔴/🟠, bỏ qua nhóm ⏸).
3. **Cập nhật AGENTS.md mục 0** — đổi các dòng ❌ liên quan ("chưa nhận đề tài", "chưa khảo sát thực địa") thành ✅, ghi ngày chính thức.
4. **Đối chiếu bảng ánh xạ ở mục 1** — với mỗi câu đã trả lời, mở đúng file/mục được chỉ ra, so giả định cũ (🔸) với câu trả lời thật.
5. **Với mỗi giả định khớp câu trả lời** → đổi 🔸 thành ✅ tại đúng chỗ, không cần ADR mới (chỉ cần note "xác nhận qua khảo sát ngày dd/mm/yyyy").
6. **Với mỗi giả định sai/khác câu trả lời** → **không sửa đè** bản ghi cũ trong DECISIONS.md, thêm ADR mới đánh dấu "Superseded by ADR-XXX" theo đúng mẫu đã có, rồi cập nhật file kỹ thuật liên quan (SKILLS.md/SECURITY_BASELINE.md/LIBRARY.md) theo quyết định mới.
7. **Dọn bảng "Việc còn để mở"** ở cuối SKILLS.md, DECISIONS.md, SECURITY_BASELINE.md — xóa dòng đã có câu trả lời, giữ nguyên dòng thuộc nhóm ⏸ hoặc chưa trả lời.
8. **Cập nhật GLOSSARY.md** nếu có thuật ngữ/role/tên gọi mới phát sinh từ câu trả lời thật (vd đơn vị dùng tên khác cho "đề thi", hoặc thêm role mới ở câu #9/#22).
9. **Ghi tóm tắt buổi đồng bộ vào `NhatKyTienDo_KhoaLuan_PhamNgocDuong.xlsx`** — liệt kê đã sửa file nào, mục nào, do khảo sát câu # nào, để phục vụ giải trình khi bảo vệ khóa luận.

Sau bước 9, AI báo lại cho Dương một bảng tóm tắt "đã đổi gì ở đâu" để review trước khi tiếp tục code — **không tự động code tiếp module nào ngay** trong cùng phiên chạy protocol này, vì mục tiêu của file là đồng bộ tài liệu, không phải sinh code.

---

## 3. Khi khảo sát chỉ trả lời một phần (không phải toàn bộ 🔴 Bắt buộc)

- Nếu chỉ vài câu 🔴 có câu trả lời (khảo sát nhiều đợt) → vẫn chạy quy trình mục 2, nhưng chỉ xử lý các dòng trong bảng ánh xạ tương ứng với câu đã trả lời, các dòng còn lại giữ nguyên 🔸.
- Không tự suy đoán câu trả lời còn thiếu dựa trên câu đã có (vd không tự đoán #26 dựa trên #29) — để trống, chờ đợt khảo sát sau.
- Mỗi lần chạy một phần như vậy, vẫn ghi vào `NhatKyTienDo...xlsx` (bước 9) để có dấu vết nhiều đợt cập nhật, tránh nhầm là một lần chốt duy nhất.

---
*File này không tự kích hoạt — chỉ chạy khi Dương xác nhận rõ ràng cả 2 điều kiện ở đầu file đã đúng. Nếu Dương chỉ nói "cập nhật giúp mình" mà chưa rõ đã đủ điều kiện chưa, AI hỏi lại trước khi chạy toàn bộ quy trình 9 bước.*
