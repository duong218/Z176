# BUSINESS REQUIREMENT / SYSTEM REQUIREMENT SPECIFICATION (SRS)
## Hệ thống thi trắc nghiệm chuyên môn nội bộ Z176

**Đơn vị áp dụng:** Công ty TNHH MTV 76 (Nhà máy Z176) - Bộ Quốc phòng
**Người thực hiện:** Phạm Ngọc Dương — Khóa luận tốt nghiệp K67, Khoa Công nghệ thông tin, Học viện Nông nghiệp Việt Nam
**Trạng thái tài liệu:** Bản chính thức hoàn thiện (Phản ánh 100% hệ thống thực tế đang vận hành)

---

## 1. GIỚI THIỆU CHUNG & BỐ CẢNH DỰ ÁN

Hệ thống thi trắc nghiệm chuyên môn nội bộ Z176 được phát triển nhằm thay thế quy trình kiểm tra năng lực thủ công và công cụ tạm thời (Google Forms). Hệ thống giải quyết triệt để các bài toán thực tế của nhà máy Z176:
- Tự động hóa quy trình soạn, đệ trình, phê duyệt và tổ chức thi.
- Đảm bảo tính minh bạch, công bằng bằng thuật toán sinh mã đề độc lập, không trùng lặp câu hỏi cho mỗi thí sinh.
- Kiểm soát nghiêm ngặt thời gian thực (realtime) quá trình làm bài của thí sinh, chống gian lận và tự động nộp bài khi phát hiện thí sinh cố tình rời khỏi phòng thi hoặc mất kết nối quá thời gian quy định.
- Thống kê, báo cáo kết quả thi theo đơn vị phòng ban chuyên môn trực quan phục vụ công tác đào tạo cán bộ định kỳ.

---

## 2. VAI TRÒ VÀ PHÂN QUYỀN (ACTORS & ROLES)

Hệ thống định nghĩa 4 vai trò nghiệp vụ (Role) hoạt động thống nhất trên cơ sở dữ liệu dùng chung:

| Vai trò (Role) | Mã Code | Mô tả chức năng thực tế |
| :--- | :--- | :--- |
| **Thí sinh** | `candidate` | - Ôn tập tài liệu được cấp phép theo phòng ban.<br>- Tham gia thi thử (không giới hạn lượt) & thi chính thức (chạy đếm ngược realtime, autosave đáp án).<br>- Tra cứu lịch sử điểm cá nhân và xem đáp án câu sai. |
| **Người ra đề** | `examiner` | - Quản lý chủ đề thi và phòng ban chuyên môn.<br>- Nhập ngân hàng câu hỏi (hỗ trợ nhập đơn lẻ hoặc import hàng loạt từ tệp Excel).<br>- Upload và phân phối tài liệu ôn tập (PDF/Word/Excel) theo bộ phận.<br>- Soạn thảo đề xuất kỳ thi (chọn số lượng câu hỏi chung/riêng, thời gian) và đệ trình lên cấp trên duyệt. |
| **Người duyệt đề** | `leader` | - Kiểm tra chi tiết và phê duyệt/từ chối/yêu cầu sửa đổi các đề xuất kỳ thi từ Examiner.<br>- Phát hành kỳ thi chính thức (hệ thống tự sinh mã đề và phân phối cho thí sinh).<br>- Theo dõi tiến độ thi, xem báo cáo tổng hợp trực quan dạng biểu đồ (phòng ban đạt/không đạt).<br>- **Cấp thêm lượt thi chính thức** cho thí sinh cụ thể khi gặp sự cố kỹ thuật bất khả kháng. |
| **Quản trị viên** | `admin` | - Quản trị người dùng (CRUD, import/preview danh sách từ Excel, xuất danh sách mật khẩu tạm).<br>- Phân quyền vai trò hệ thống, khóa/mở khóa tài khoản, reset mật khẩu.<br>- Đổi và tùy chỉnh logo đơn vị hiển thị trên hệ thống.<br>- Giám sát an ninh qua hệ thống Nhật ký hoạt động chi tiết (Audit Logs). |

---

## 3. LUỒNG NGHIỆP VỤ HỆ THỐNG (BUSINESS WORKFLOW)

Quy trình vận hành thực tế của hệ thống diễn ra khép kín qua các bước sau:

```text
  [Người Ra Đề] soạn ngân hàng câu hỏi (Import Excel) & Upload tài liệu ôn tập
        │
        ▼
  [Người Ra Đề] tạo Đề xuất kỳ thi (Chọn tỷ lệ Câu hỏi chung / Câu hỏi riêng bộ phận)
        │
        ▼ (Đệ trình duyệt)
  [Người Duyệt Đề] thẩm định đề xuất -> Phê duyệt / Từ chối (nêu lý do)
        │
        ▼ (Phát hành)
  [Hệ Thống] tự động sinh các mã đề thi khác nhau (đảo câu hỏi/đáp án), phân cho thí sinh
        │
        ▼
  [Thí Sinh] học tập tài liệu ôn tập -> Thực hiện làm bài thi (Realtime Heartbeat & Autosave)
        │
        ▼ (Nộp bài / Hết giờ / Mất kết nối rời phòng thi quá 1 phút)
  [Hệ Thống] khóa bài thi -> Chấm điểm tự động -> Lưu kết quả thi
        │
        ▼
  [Người Duyệt/Admin] xem báo cáo thống kê trực quan -> Xuất tệp Excel kết quả chi tiết
```

---

## 4. CÁC TÍNH NĂNG VÀ YÊU CẦU HỆ THỐNG (SYSTEM REQUIREMENTS)

### 4.1. Quản lý Ngân hàng Câu hỏi & Tài liệu ôn tập
*   **Ngân hàng câu hỏi phân cấp**:
    *   Tổ chức theo **Chủ đề lớn** (vd: An toàn lao động, Kỹ thuật dệt may).
    *   Phân loại theo **Phạm vi áp dụng (Scope)**: **Dùng chung** (áp dụng cho toàn bộ thí sinh) hoặc **Riêng theo phòng ban** (chỉ hiển thị cho công nhân viên thuộc phòng ban đó).
    *   Độ khó gồm 3 mức: **Dễ**, **Trung bình**, **Khó**.
    *   Hỗ trợ 2 kiểu đáp án: **Chọn một đáp án đúng (single)** hoặc **Chọn nhiều đáp án đúng (multiple)**.
*   **Phương thức nhập liệu**: Nhập thủ công qua form giao diện hoặc **Import hàng loạt từ Excel** (có kiểm tra tính hợp lệ dữ liệu và cấu trúc file mẫu). Hỗ trợ tải ảnh minh họa câu hỏi trực tiếp lên Cloudinary.
*   **Tài liệu ôn tập độc lập**: Cho phép Examiner tải lên tài liệu ôn tập (.pdf, .docx, .xlsx). Tài liệu được cấu hình phạm vi riêng theo phòng ban, hệ thống stream tệp tin qua Blob URL có đính kèm Header Authorization bảo mật (thí sinh không thể tải nếu chưa đăng nhập). Tài liệu ôn tập tách biệt hoàn toàn và không dùng để sinh đề thi tự động.

### 4.2. Thuật toán Sinh đề & Phân phối Mã đề thi
*   **Sinh mã đề có ràng buộc**: Khi Examiner tạo đề xuất, họ cấu hình số lượng câu hỏi của đề (ví dụ: 30 câu) và chỉ định cụ thể **Số câu hỏi dùng chung** (lý thuyết nền tảng) và **Số câu hỏi riêng theo phòng ban** trong đề thi đó.
*   **Sinh mã đề ngẫu nhiên không trùng lặp**: Khi Leader nhấn "Phát hành", hệ thống sẽ sinh ra các mã đề khác nhau (đảo thứ tự câu hỏi và thứ tự các phương án trả lời). Thuật toán đảm bảo không có 2 mã đề thi nào trùng khớp 100% cấu trúc câu hỏi.
*   **Gán đề thông minh**: Hệ thống tự động gán mã đề cho từng thí sinh được quyền thi. Thí sinh thuộc bộ phận nào sẽ chỉ nhận được mã đề chứa các câu hỏi riêng liên quan đến bộ phận đó kết hợp với các câu hỏi chung của kỳ thi.

### 4.3. Quản lý Quy trình Phê duyệt (Workflow)
*   Hệ thống kiểm soát vòng đời của một kỳ thi thông qua các trạng thái nghiêm ngặt:
    *   `draft`: Bản nháp do Examiner soạn thảo, đang cấu hình.
    *   `pending_review`: Đề xuất đã được đệ trình lên cấp trên, chờ duyệt.
    *   `rejected`: Leader từ chối đề xuất và bắt buộc nhập lý do từ chối (trả về trạng thái nháp để Examiner sửa đổi).
    *   `approved`: Đề xuất đã được duyệt, sẵn sàng phát hành.
    *   `published`: Kỳ thi chính thức được phát hành, bắt đầu mở đề theo thời gian đã cấu hình, thí sinh có thể vào thi.
    *   `archived`: Kỳ thi đã kết thúc thời gian thi, được lưu trữ lịch sử và khóa toàn bộ thao tác làm bài.

### 4.4. Cơ chế Giám sát & Làm bài thi thời gian thực (Realtime Security)
*   **Autosave**: Giao diện làm bài gọi API lưu trạng thái đáp án (`/exam-attempts/:id/answer`) mỗi khi thí sinh tích chọn đáp án. Giúp bảo toàn bài làm khi xảy ra mất điện hoặc sập trình duyệt.
*   **Realtime Heartbeat**: Cứ mỗi 15 giây, client gửi một tín hiệu heartbeat lên server để duy trì trạng thái hoạt động của lượt thi.
*   **Tự động khóa và nộp bài chống gian lận**: 
    *   Nếu thí sinh tắt trình duyệt, chuyển tab quá số lần quy định, hoặc mất kết nối internet mà **không gửi tín hiệu heartbeat lên máy chủ quá 1 phút (60 giây)**, hệ thống backend sẽ ngay lập tức **tự động nộp bài (auto-submit)** với trạng thái lượt thi chuyển sang `expired`, lý do tự nộp là `inactive_timeout` và chấm điểm dựa trên những câu đã lưu.
    *   Thí sinh quay lại sẽ bị chặn không cho làm tiếp và hiển thị thông báo phiên thi đã bị khóa do vi phạm quy chế hoặc rời khỏi ca thi quá thời gian quy định.
*   **Cấp lượt thi bổ sung**: Trong trường hợp thí sinh gặp sự cố bất khả kháng (mất mạng khách quan), Leader có quyền thao tác trực tiếp trên trang báo cáo để cấp thêm 1 lượt thi chính thức cho thí sinh đó làm lại bài.

### 4.5. Chấm điểm & Báo cáo kết quả
*   **Chấm điểm tự động**: Hệ thống so sánh đáp án thí sinh đã nộp với đáp án chính xác trong DB. Điểm số được tính theo thang điểm 100.
*   **Ngưỡng điểm đạt**: Được cấu hình độc lập trên từng kỳ thi (`passThresholdPercent`, mặc định là 70%). Thí sinh có tỷ lệ câu đúng lớn hơn hoặc bằng ngưỡng này sẽ có trạng thái kết quả là `Passed (Đạt)`, ngược lại là `Failed (Không đạt)`.
*   **Tra cứu kết quả công khai**: Người dùng bên ngoài có thể tra cứu kết quả thi theo mã nhân viên hoặc danh sách tổng hợp theo phòng ban tại trang chủ mà không cần đăng nhập hệ thống, đảm bảo tính trực quan và công bố rộng rãi của cuộc thi.
*   **Xuất Excel báo cáo chuyên nghiệp**: Leader và Admin có thể tải về tệp báo cáo tổng hợp và báo cáo chi tiết điểm số, số câu đúng/sai, trạng thái đạt/không đạt của toàn bộ thí sinh được định dạng rõ ràng qua thư viện `exceljs`.

---

## 5. MÔ HÌNH DỮ LIỆU THỰC TẾ (DATABASE SCHEMA MAPPING)

Dữ liệu được lưu trữ tập trung trên MongoDB thông qua các thực thể chính sau:

| Model | Collection | Chức năng chính |
| :--- | :--- | :--- |
| `Role` | `roles` | Lưu thông tin các vai trò hệ thống: admin, examiner, leader, candidate. |
| `User` | `users` | Tài khoản đăng nhập, chứa username, passwordHash, roleId, mustChangePassword và tokenVersion. |
| `Employee` | `employees` | Hồ sơ cá nhân nhân viên (fullname, employeeCode, phone, dob, position) liên kết 1-1 với `User` và `Department`. |
| `Department` | `departments` | Danh mục phòng ban chuyên môn trong nhà máy Z176. |
| `Topic` | `topics` | Danh mục các chủ đề lớn của kỳ thi. |
| `Question` | `questions` | Ngân hàng câu hỏi: nội dung, questionKind, answerType, difficulty, scope, topicId, departmentId, imageUrl. |
| `Answer` | `answers` | Lưu các phương án trả lời tương ứng của câu hỏi, chứa cờ `isCorrect`. |
| `Exam` | `exams` | Cấu hình kỳ thi và vòng đời phê duyệt (title, topicId, startDate, endDate, durationMinutes, totalQuestions, commonQuestionCount, departmentQuestionCount, status, passThresholdPercent). |
| `ExamCode` | `examcodes` | Các biến thể mã đề thi được tạo ra tự động sau khi phát hành. |
| `ExamCodeQuestion` | `examcodequestions` | Bảng liên kết trung gian xác định thứ tự đảo câu hỏi của từng mã đề. |
| `ExamCandidate` | `examcandidates` | Danh sách thí sinh được gán vào kỳ thi, liên kết với mã đề thi cụ thể, lưu số lượt thi tối đa và lượt thi đã dùng. |
| `ExamAttempt` | `examattempts` | Phiên làm bài cụ thể của thí sinh (startedAt, submittedAt, status: in_progress/submitted/expired, lastActiveAt, autoSubmitReason). |
| `CandidateAnswer` | `candidateanswers` | Lưu chi tiết các đáp án thí sinh đã lựa chọn khi nộp bài thi. |
| `Result` | `results` | Bảng điểm kết quả cuối cùng của lượt thi, lưu điểm số, số câu đúng và trạng thái passed/failed. |
| `StudyDocument` | `studydocuments` | File tài liệu ôn tập được upload (lưu Cloudinary URL) phân theo chủ đề và phòng ban. |
| `AuditLog` | `auditlogs` | Ghi nhật ký hành động thay đổi dữ liệu của Admin và cán bộ. |
| `Notification` | `notifications` | Hộp thư thông báo nội bộ realtime gửi cho người dùng khi có sự kiện mới. |

---

## 6. KHẢ NĂNG BẢO MẬT & ĐỘ TIN CẬY (SECURITY BASELINE)

- **Ngăn ngừa đăng nhập nhiều thiết bị**: Mỗi khi người dùng đăng nhập mới ở thiết bị khác, hệ thống tự động tăng `tokenVersion` trên model `User` -> vô hiệu hóa tức thì toàn bộ access token cũ đang lưu hành ở các thiết bị trước đó. Client định kỳ 5s sẽ phát hiện và chặn màn hình thao tác của người dùng cũ bằng `SessionRevokedModal`.
- **Bảo mật file tài liệu**: Tài liệu ôn tập không thể truy cập trực tiếp bằng liên kết tĩnh. Đường dẫn tải file yêu cầu xác thực JWT. Server sẽ stream file nhị phân trực tiếp dưới dạng Blob, đảm bảo chỉ nhân viên có tài khoản hợp lệ mới xem được tài liệu của nhà máy.
- **Rate Limiting**: Toàn bộ luồng thao tác bài thi (gửi đáp án, bắt đầu thi, heartbeat, nộp bài) đều được bọc qua middleware giới hạn tần suất yêu cầu để ngăn chặn thí sinh spam API hoặc sử dụng công cụ tự động dò đáp án.
- **Audit Logging**: Mọi hành vi nhạy cảm của người dùng (khóa tài khoản, thay đổi quyền, đổi logo hệ thống, chỉnh sửa ngân hàng đề, phê duyệt kỳ thi) đều được hệ thống ghi vết vĩnh viễn vào bộ sưu tập `auditlogs` phục vụ thanh tra an ninh bảo mật nội bộ.
