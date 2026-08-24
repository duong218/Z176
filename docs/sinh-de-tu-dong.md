# Sinh đề thi tự động

## Nguồn

| File | Vai trò |
|---|---|
| `server/src/services/exam.service.js` | Chứa hàm `publishExam` — nơi **kích hoạt** việc sinh đề khi Người duyệt đề (Leader) bấm "Đăng chính thức" một kỳ thi đã được phê duyệt. |
| `server/src/services/exam-code-generation.service.js` | Chứa toàn bộ logic **thuật toán sinh đề và phân bổ thí sinh**: tính toán câu hỏi, trộn đề Fisher–Yates, cơ chế bù đắp câu hỏi, tạo mã đề, gán thí sinh, và tự động gán nhân viên mới tạo sau khi kỳ thi đã phát hành. |
| `server/src/models/exam-code.model.js` | Lưu trữ 1 mã đề (`ExamCode` - ví dụ `D3F9A1-KYTHUAT`), gắn với 1 kỳ thi (`examId`) và 1 phòng ban cụ thể (`departmentId`), kèm chuỗi mã băm `fingerprint` (SHA-256). |
| `server/src/models/exam-code-question.model.js` | Lưu danh sách câu hỏi (`questionId`) thuộc về 1 mã đề cụ thể (`examCodeId`), kèm số thứ tự hiển thị index. |
| `server/src/models/exam-candidate.model.js` | Lưu bảng phân bổ "nhân viên nào được gán mã đề nào trong kỳ thi nào", quản lý số lượt thi đã dùng (`attemptsUsed`) và số lượt cấp thêm (`extraAttemptsGranted`). |
| `server/src/controllers/exam.controller.js` | Nhận request HTTP `POST /api/exams/:id/publish`, gọi `publishExam`, ghi vết audit log hệ thống. |

---

## Bài toán nghiệp vụ

Một kỳ thi chuyên môn tại Nhà máy Z176 (ví dụ *"Kiểm tra An toàn Lao động & PCCC Quý 3"*) có nhiều phòng ban/phân xưởng cùng tham gia. Mỗi phòng ban cần một bộ câu hỏi đặc thù:
- **Phần câu hỏi Chung (`Common`)**: Áp dụng cho toàn bộ cán bộ công nhân viên trong đơn vị (kiến thức pháp luật, nội quy chung, an toàn vệ sinh lao động cơ bản).
- **Phần câu hỏi Riêng (`DepartmentSpecific`)**: Chỉ riêng phòng ban đó mới có (ví dụ câu hỏi nghiệp vụ Xưởng Cơ khí khác Xưởng Vũ khí/Khí tài, Phòng Kỹ thuật khác Phòng Kế hoạch).

Vì vậy, hệ thống không dùng một bộ đề duy nhất cho toàn công ty, mà tự động sinh ra **nhiều mã đề thi — mỗi phòng ban một mã đề riêng biệt** — rồi tự động gán toàn bộ nhân viên vào đúng mã đề của phòng ban trực thuộc.

Toàn bộ quy trình diễn ra **hoàn toàn tự động**: Người duyệt đề (Leader) chỉ cần bấm một nút *"Đăng chính thức"* (`publish`), hệ thống sẽ tự tính toán, kiểm tra số lượng câu hỏi, trộn ngẫu nhiên và phân bổ đề thi cho từng thí sinh mà không cần can thiệp thủ công.

---

## Thời điểm kích hoạt

Việc sinh đề **không** xảy ra lúc Người ra đề (Examiner) tạo dự thảo (`draft`), cũng **không** xảy ra lúc Người duyệt đề (Leader) duyệt đề xuất (`approved`).

Quy trình sinh đề chỉ xảy ra ở **đúng 1 thời điểm**: Khi trạng thái kỳ thi chuyển từ `approved` sang `published` (khi API `POST /api/exams/:id/publish` được kích hoạt và gọi `publishExam`).

Quy trình thực thi bên trong `publishExam`:
```text
1. Kiểm tra trạng thái kỳ thi hiện tại phải là "approved" (nếu sai ném lỗi ApiError)
   │
2. Gọi generateExamCodesAndAssignCandidates(exam)   [Bước sinh đề và gán thí sinh]
   │
   ├─ Nếu có lỗi thiếu câu hỏi hoặc lỗi hệ thống: Dừng ngay, KHÔNG đổi trạng thái Exam
   │
3. Nếu sinh đề thành công: Cập nhật trạng thái kỳ thi sang "published"
   │
4. Gửi thông báo tự động (Notification) tới các thí sinh được gán vào kỳ thi
```

> [!IMPORTANT]
> Thứ tự này đảm bảo tính toàn vẹn dữ liệu: Nếu ngân hàng câu hỏi của bất kỳ phòng ban nào không đáp ứng đủ yêu cầu, kỳ thi sẽ **không bao giờ bị chuyển sang trạng thái "published" dở dang**.

---

## Luồng xử lý chi tiết trong `generateExamCodesAndAssignCandidates`

```
Exam (approved)
  │
  ├─ Bước 1: Lấy danh sách tất cả nhân viên đang hoạt động (isActive: true)
  │          Nhóm theo từng phòng ban (chỉ xử lý phòng ban có ít nhất 1 nhân viên)
  │
  ├─ Bước 2: Kiểm tra ngân hàng câu hỏi của TẤT CẢ phòng ban (validateQuestionAvailability)
  │          - Đếm pool câu hỏi Chung (Common) thuộc chủ đề
  │          - Đếm pool câu hỏi Riêng (DepartmentSpecific) của từng phòng ban
  │          - Áp dụng cơ chế BÙ THÊM từ câu Chung nếu câu Riêng không đủ
  │          - Nếu TỔNG (Chung + Riêng) vẫn thiếu -> Ném lỗi chi tiết từng phòng ban và CHẶN LẠI
  │
  ├─ Bước 3: Tạo mã đề cho từng phòng ban
  │          - Lấy ngẫu nhiên số câu Chung và số câu Riêng theo plan đã tính
  │          - Trộn ngẫu nhiên (Fisher–Yates shuffle) gộp chung 2 tập câu hỏi
  │          - Tạo ExamCode (ví dụ: A1B2C3-KYTHUAT) kèm fingerprint SHA-256
  │          - Tạo ExamCodeQuestion lưu danh sách câu hỏi cho mã đề
  │
  └─ Bước 4: Tạo ExamCandidate gán toàn bộ nhân viên trong phòng ban vào ExamCode tương ứng
```

### Bước 1 — Xác định các phòng ban cần sinh đề
- Hệ thống truy vấn toàn bộ nhân viên `Employee` đang hoạt động (`isActive: true`).
- Nhóm danh sách nhân viên theo `departmentId`.
- Chỉ các phòng ban **đang có ít nhất 1 nhân viên hoạt động** mới được đưa vào danh sách sinh đề. Những phòng ban không có nhân sự sẽ được bỏ qua nhằm tối ưu tài nguyên lưu trữ.
- Nếu toàn hệ thống không có bất kỳ nhân viên nào đang hoạt động, quy trình sẽ ném lỗi `NO_CANDIDATES_AVAILABLE`.

### Bước 2 — Kiểm tra câu hỏi & Cơ chế Bù đắp thông minh (`validateQuestionAvailability`)
Người ra đề quy định 2 thông số trong cấu hình kỳ thi:
- `commonQuestionCount`: Số lượng câu hỏi chung cần lấy.
- `departmentQuestionCount`: Số lượng câu hỏi riêng cần lấy.

Với mỗi phòng ban tham gia, hệ thống thực hiện kiểm tra 2 kho câu hỏi:
1. **Pool câu Chung**: `Question` thuộc đúng `topicId`, `scope = 'Common'`, `isActive = true`.
2. **Pool câu Riêng**: `Question` thuộc đúng `topicId`, `scope = 'DepartmentSpecific'`, đúng `departmentId`, `isActive = true`.

**Thuật toán Bù đắp câu hỏi (Smart Fallback Mechanism):**
- Nếu kho câu riêng của phòng ban có đủ `departmentQuestionCount`: Lấy đúng số câu riêng yêu cầu và số câu chung yêu cầu.
- Nếu kho câu riêng **bị thiếu** (ví dụ cần 5 câu riêng nhưng phòng ban chỉ có 3 câu):
  - Hệ thống lấy tất cả 3 câu riêng hiện có.
  - Số câu còn thiếu (2 câu) sẽ được **tự động bù thêm từ pool câu hỏi Chung** (số câu chung cần lấy = `commonQuestionCount + 2`).
- **Điều kiện ném lỗi chặn phát hành:** Chỉ khi tổng số câu Chung + câu Riêng của phòng ban nhỏ hơn tổng số câu của cả đề thi (`commonQuestionCount + departmentQuestionCount`), hệ thống mới báo lỗi và trả về chi tiết tên phòng ban kèm số lượng câu bị thiếu.

### Bước 3 — Trộn ngẫu nhiên và Khởi tạo Mã đề (`ExamCode`)
Với số lượng câu hỏi đã tính toán từ plan ở Bước 2:
1. Trích xuất ngẫu nhiên (Fisher–Yates shuffle) đủ số câu từ pool Chung và pool Riêng.
2. Trộn chung toàn bộ danh sách câu hỏi đã chọn thành một danh sách duy nhất.
3. Sinh chuỗi mã đề hiển thị: `buildExamCode(exam, department)` theo định dạng:
   `{6 ký tự cuối ExamId}-{Mã/Tên phòng ban viết hoa không dấu, tối đa 10 ký tự}` (Ví dụ: `D3F9A1-XUONG1`).
4. Lưu bản ghi `ExamCode` vào cơ sở dữ liệu.
5. Tạo các bản ghi `ExamCodeQuestion` lưu danh sách `questionId` kèm chỉ số thứ tự mặc định `orderIndex`.
6. Tính toán mã băm `fingerprint` (SHA-256) từ danh sách ID câu hỏi đã sắp xếp để nhận diện bộ câu hỏi.

> [!NOTE]
> `ExamCode` và `ExamCodeQuestion` đại diện cho bộ câu hỏi chung cố định của một phòng ban. Khi từng cá nhân thí sinh bước vào phòng thi, hệ thống sẽ thực hiện một bước xáo thứ tự câu hỏi và đáp án độc lập khác (`AttemptQuestion`) trong `exam-attempt.service.js`.

### Bước 4 — Gán Thí sinh vào Mã đề (`ExamCandidate`)
- Với mỗi nhân viên thuộc phòng ban, hệ thống tạo bản ghi `ExamCandidate` liên kết `examId`, `userId`, `examCodeId`.
- Mặc định khởi tạo `attemptsUsed = 0` và `extraAttemptsGranted = 0`.

---

## Tính Bất biến và Cơ chế Chống lỗi (Idempotency & Resilience)

Hệ thống được thiết kế để chịu lỗi mạng hoặc sự cố gián đoạn giữa chừng:
- **Tái sử dụng Mã đề đã tạo**: Nếu quá trình phát hành bị ngắt quãng và Leader bấm phát hành lại, hệ thống kiểm tra `ExamCode` đã tồn tại cho phòng ban đó chưa. Nếu đã có, hệ thống sử dụng lại nguyên vẹn mã đề cũ, không sinh lại đề mới làm sai lệch bộ câu hỏi.
- **Không bỏ sót và không trùng Thí sinh**: Hệ thống chỉ tạo `ExamCandidate` cho những nhân viên chưa có bản ghi trong kỳ thi đó. Những nhân viên đã được gán trước đó sẽ được giữ nguyên.

---

## Xử lý Tự động khi Tạo Nhân viên mới (`assignEmployeeToActiveExamIfAny`)

Khi Quản trị viên tạo tài khoản nhân viên mới (tạo đơn lẻ hoặc import Excel) trong thời gian một kỳ thi đang ở trạng thái `published` (đang mở thi):

1. Hệ thống tìm kiếm kỳ thi đang `published` tương ứng.
2. Kiểm tra xem phòng ban của nhân viên mới đã có `ExamCode` của kỳ thi đó hay chưa:
   - **Đã có mã đề**: Sử dụng lại `ExamCode` có sẵn của phòng ban để gán cho nhân viên mới vào `ExamCandidate`.
   - **Chưa có mã đề** (do lúc publish phòng ban này chưa có nhân viên nào): Hệ thống tự động kích hoạt logic sinh `ExamCode` mới riêng cho phòng ban này và gán nhân viên vào.
3. **Cơ chế Nuốt lỗi An toàn**: Nếu việc gán đề cho nhân viên mới thất bại (ví dụ ngân hàng câu hỏi của phòng ban mới không đủ), lỗi sẽ chỉ được ghi cảnh báo vào hệ thống nhật ký, **không ném lỗi chặn việc tạo tài khoản nhân viên**.
4. **Xử lý Xung đột Đồng thời (Concurrency Lock - Error 11000)**: Khi có 2 request tạo nhân viên cùng phòng ban chạy đồng thời, cả 2 có thể cùng phát hiện "chưa có mã đề" và cùng tạo `ExamCode`. Khi đó MongoDB sẽ trả về lỗi trùng lặp mã duy nhất `E11000`. Hệ thống chủ động bắt mã lỗi này, tự động chuyển sang đọc lại mã đề vừa được tạo bởi request kia và hoàn tất gán thí sinh mà không gặp bất kỳ lỗi nào.

