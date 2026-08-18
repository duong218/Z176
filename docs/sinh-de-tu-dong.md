# Sinh đề thi tự động

## Nguồn

| File | Vai trò |
|---|---|
| `server/src/services/exam.service.js` | Chứa hàm `publishExam` — nơi **kích hoạt** việc sinh đề, khi Người duyệt đề bấm "Đăng chính thức" một kỳ thi. |
| `server/src/services/exam-code-generation.service.js` | Chứa toàn bộ logic **thật sự sinh đề**: chọn câu hỏi, tạo mã đề, gán thí sinh vào mã đề. |
| `server/src/models/exam-code.model.js` | Lưu 1 mã đề (ví dụ `DE001-KYTHUAT`), gắn với 1 kỳ thi và 1 phòng ban cụ thể. |
| `server/src/models/exam-code-question.model.js` | Lưu danh sách câu hỏi thuộc về 1 mã đề, kèm thứ tự hiển thị mặc định. |
| `server/src/models/exam-candidate.model.js` | Lưu việc "nhân viên nào được gán mã đề nào, trong kỳ thi nào". |
| `server/src/controllers/exam.controller.js` | Nhận request HTTP `POST /api/exams/:id/publish`, gọi `publishExam`, ghi audit log. |

## Bài toán nghiệp vụ

Một kỳ thi (ví dụ "An toàn lao động Quý 3") có nhiều phòng ban cùng tham gia. Mỗi phòng ban cần một bộ câu hỏi riêng: một phần câu hỏi **chung** cho tất cả mọi người, một phần câu hỏi **riêng** chỉ phòng ban đó mới có (ví dụ câu hỏi đặc thù cho xưởng cơ khí sẽ khác xưởng điện). Vì vậy hệ thống không dùng 1 đề duy nhất cho toàn công ty, mà sinh ra **nhiều mã đề — mỗi phòng ban 1 mã đề riêng** — rồi tự động gán đúng người vào đúng mã đề của phòng ban họ.

Việc này diễn ra **tự động, không cần Người duyệt đề chọn tay từng câu hỏi hay gán tay từng nhân viên** — họ chỉ cần bấm nút "Đăng chính thức" (publish), toàn bộ phần còn lại do hệ thống tự tính.

## Thời điểm kích hoạt

Việc sinh đề **không** xảy ra lúc tạo đề xuất (draft) hay lúc Người duyệt đề chấp thuận (approve). Nó chỉ xảy ra ở **đúng 1 thời điểm**: khi trạng thái kỳ thi chuyển từ `approved` sang `published`, tức là hàm `publishExam` trong `exam.service.js` được gọi.

Bên trong `publishExam`, việc sinh đề được gọi **trước khi** đổi trạng thái kỳ thi:

```
kiểm tra kỳ thi đang ở trạng thái "approved"
→ gọi generateExamCodesAndAssignCandidates(exam)   [bước sinh đề]
→ nếu bước trên không lỗi: mới đổi trạng thái kỳ thi thành "published"
```

Thứ tự này có chủ đích: nếu ngân hàng câu hỏi không đủ để sinh đề, quá trình sẽ dừng lại và báo lỗi **trước khi** kỳ thi kịp chuyển sang "published" — tránh tình trạng kỳ thi đã được công bố nhưng có phòng ban không có đề để thi.

## Luồng xử lý chi tiết bên trong `generateExamCodesAndAssignCandidates`

### Bước 1 — Xác định những phòng ban nào cần có đề

Hệ thống lấy toàn bộ nhân viên đang hoạt động (`isActive: true`), nhóm họ theo phòng ban. Chỉ những phòng ban **đang có ít nhất 1 nhân viên hoạt động** mới cần sinh đề — phòng ban không có ai thì bỏ qua, không tốn công sinh đề vô ích.

Nếu toàn công ty không có nhân viên nào đang hoạt động, quá trình dừng lại và báo lỗi ngay (không có ai để thi thì không cần sinh đề).

### Bước 2 — Kiểm tra đủ câu hỏi cho từng phòng ban TRƯỚC khi tạo bất kỳ đề nào

Đây là bước quan trọng nhất về mặt an toàn dữ liệu. Với mỗi phòng ban, hệ thống kiểm tra 2 nguồn câu hỏi:

- **Câu hỏi chung**: thuộc đúng chủ đề (`topicId`) của kỳ thi, có phạm vi (`scope`) là "chung", đang hoạt động.
- **Câu hỏi riêng của phòng ban**: cùng chủ đề, phạm vi là "riêng phòng ban", và đúng `departmentId` của phòng ban đó.

Số lượng cần lấy được quyết định bởi 2 con số Người ra đề đã khai báo lúc tạo đề xuất: `commonQuestionCount` (số câu chung) và `departmentQuestionCount` (số câu riêng).

**Cơ chế "bù qua lại" khi thiếu câu riêng:** Nếu một phòng ban không đủ câu hỏi riêng (ví dụ cần 5 câu riêng nhưng ngân hàng chỉ có 3 câu), hệ thống **không báo lỗi ngay** — thay vào đó, phần còn thiếu (2 câu) sẽ được lấy bù từ pool câu hỏi **chung**. Chỉ khi nào tổng cả 2 pool (chung + riêng) vẫn không đủ tổng số câu cần thiết, hệ thống mới thực sự báo lỗi và chặn việc phát hành kỳ thi, kèm thông báo rõ phòng ban nào đang thiếu và thiếu bao nhiêu.

Việc kiểm tra này chạy cho **tất cả** phòng ban cần đề trước, rồi mới bắt đầu tạo đề cho bất kỳ phòng ban nào — nếu chỉ 1 phòng ban trong số nhiều phòng ban bị thiếu câu hỏi, toàn bộ quá trình publish sẽ dừng lại, không có phòng ban nào được tạo đề dở dang.

### Bước 3 — Với mỗi phòng ban: chọn câu hỏi và tạo mã đề

Với số lượng câu đã xác định ở Bước 2, hệ thống:

1. Chọn ngẫu nhiên đúng số câu cần từ pool câu chung, và đúng số câu cần từ pool câu riêng của phòng ban.
2. Trộn ngẫu nhiên (thuật toán Fisher–Yates) toàn bộ danh sách câu đã chọn (chung + riêng) thành 1 danh sách duy nhất — không tách riêng phần chung/riêng khi hiển thị, để thí sinh không đoán được câu nào là câu "chung" câu nào là câu "riêng".
3. Tạo 1 bản ghi `ExamCode` — đây chính là "mã đề" của phòng ban đó cho kỳ thi này. Mã đề được đặt tên theo dạng `{6 ký tự cuối của mã kỳ thi}-{mã hoặc tên phòng ban viết hoa, tối đa 10 ký tự}`.
4. Ghi danh sách câu hỏi đã chọn vào `ExamCodeQuestion`, mỗi câu kèm số thứ tự hiển thị mặc định.
5. Tính 1 giá trị "dấu vân tay" (fingerprint) từ danh sách ID câu hỏi bằng thuật toán băm SHA-256 — dùng để sau này có thể kiểm tra nhanh xem 2 mã đề có trùng hoàn toàn bộ câu hỏi với nhau không, mà không cần so sánh từng câu một.

**Lưu ý quan trọng:** Đây là bước tạo ra bộ câu hỏi **cố định** cho cả phòng ban — mọi nhân viên trong cùng phòng ban sẽ nhận cùng 1 bộ câu hỏi này (`ExamCode` + `ExamCodeQuestion`). Việc **xáo lại thứ tự câu hỏi cho từng cá nhân** là một bước hoàn toàn khác, xảy ra sau đó ở một service riêng (`exam-attempt.service.js`, lúc thí sinh bấm "Bắt đầu thi") — không nằm trong phạm vi tài liệu này.

### Bước 4 — Gán từng nhân viên trong phòng ban vào mã đề vừa tạo

Sau khi có mã đề cho phòng ban, hệ thống tạo 1 bản ghi `ExamCandidate` cho mỗi nhân viên trong phòng ban đó — bản ghi này chính là câu trả lời cho câu hỏi "nhân viên X sẽ thi mã đề nào, trong kỳ thi nào".

## Cơ chế chống lỗi khi publish nhiều lần / publish bị gián đoạn giữa chừng

Đây là phần được thiết kế cẩn thận để tránh một tình huống nguy hiểm: nếu quá trình publish bị lỗi ở giữa chừng (ví dụ đã tạo xong mã đề cho 3/5 phòng ban thì gặp lỗi mạng/DB), Người duyệt đề có thể sẽ bấm "Đăng chính thức" lại lần nữa. Hệ thống phải đảm bảo lần gọi lại đó:

- **Không tạo trùng mã đề** cho phòng ban đã có mã đề từ lần chạy trước — hệ thống kiểm tra `ExamCode` đã tồn tại cho từng phòng ban chưa, nếu có rồi thì dùng lại nguyên mã đề cũ (không tính lại, không tạo mới), để đảm bảo toàn bộ nhân viên cùng phòng ban luôn nhận đúng 1 bộ câu hỏi duy nhất, không bị lệch giữa các lần chạy.
- **Không bỏ sót nhân viên nào** — với mỗi phòng ban, hệ thống chỉ gán những nhân viên **chưa từng có** `ExamCandidate` cho kỳ thi này. Nhân viên nào đã được gán ở lần chạy trước sẽ không bị đụng tới; nhân viên nào chưa có (do lần trước lỗi giữa chừng) sẽ được bổ sung ở lần chạy này.

Nói cách khác: gọi lại quá trình sinh đề bao nhiêu lần cũng an toàn — nó chỉ luôn bổ sung đúng phần còn thiếu, không bao giờ tạo dữ liệu trùng lặp hay ghi đè dữ liệu đã có.

## Trường hợp đặc biệt: nhân viên mới được tạo SAU KHI kỳ thi đã publish

Hàm `assignEmployeeToActiveExamIfAny` xử lý tình huống: công ty tạo thêm tài khoản cho 1 nhân viên mới, trong khi kỳ thi đang ở trạng thái "published" (đã phát hành, đang diễn ra hoặc sắp diễn ra). Nhân viên mới này cần được tự động gán vào đúng đề của phòng ban mình, dù không có mặt lúc kỳ thi được publish lần đầu.

Luồng xử lý:

1. Tìm kỳ thi đang published (nếu không có kỳ thi nào đang published thì bỏ qua, không làm gì).
2. Kiểm tra nhân viên đã được gán đề chưa (tránh gán trùng).
3. Nếu phòng ban của nhân viên **đã có mã đề** từ trước (do đã publish theo phòng ban này rồi) → dùng lại mã đề đó.
4. Nếu phòng ban đó **chưa từng có mã đề** (trường hợp lúc publish, phòng ban này chưa có nhân viên nào) → tạo mới mã đề cho phòng ban đó ngay tại đây, dùng đúng logic chọn câu hỏi giống Bước 2-3 ở trên.
5. Tạo `ExamCandidate` gán nhân viên vào mã đề.

**Điểm khác biệt quan trọng so với luồng publish:** nếu bước gán này thất bại (ví dụ ngân hàng câu hỏi phòng ban đó không đủ), lỗi **chỉ được ghi log cảnh báo ra console, không được ném ra ngoài** để chặn việc tạo tài khoản. Lý do: việc gán đề thi không phải là điều kiện bắt buộc để tạo được tài khoản nhân viên — nhân viên vẫn cần được tạo tài khoản thành công dù việc gán đề (nếu) thất bại; quản trị viên có thể xử lý gán đề thủ công hoặc bổ sung câu hỏi sau.

**Xử lý tình huống 2 request tạo nhân viên cùng phòng ban chạy đồng thời:** Nếu 2 nhân viên mới cùng phòng ban được tạo gần như cùng lúc, cả 2 request có thể cùng thấy "phòng ban này chưa có mã đề" và cùng cố gắng tạo mã đề mới — vi phạm ràng buộc duy nhất (unique) trên cặp `{examId, code}`. Khi gặp đúng lỗi này (mã lỗi MongoDB `11000`), hệ thống không coi là lỗi thật, mà hiểu là "request kia đã tạo xong trước", tự động lấy lại mã đề vừa được tạo đó để dùng tiếp — không làm gián đoạn việc tạo tài khoản nhân viên.

## Tóm tắt luồng dữ liệu

```
Exam (trạng thái "approved")
  │  Người duyệt đề bấm "Đăng chính thức"
  ▼
publishExam()  [exam.service.js]
  │
  ▼
generateExamCodesAndAssignCandidates()  [exam-code-generation.service.js]
  │
  ├─ Với mỗi phòng ban có nhân viên hoạt động:
  │     │
  │     ├─ Kiểm tra đủ câu hỏi (chung + riêng, có cơ chế bù qua lại)
  │     │
  │     ├─ Tạo ExamCode (1 mã đề riêng cho phòng ban)
  │     │
  │     ├─ Tạo ExamCodeQuestion (danh sách câu hỏi thuộc mã đề đó)
  │     │
  │     └─ Tạo ExamCandidate cho từng nhân viên trong phòng ban
  │           (nhân viên ─ kỳ thi ─ mã đề)
  │
  ▼
Exam chuyển trạng thái "published"
```

## Giới hạn / lưu ý khi viết báo cáo

- Việc "sinh đề" ở đây là sinh đề **theo phòng ban**, không phải theo từng cá nhân — mọi người trong cùng phòng ban thi cùng 1 bộ câu hỏi (nhưng thứ tự hiển thị được xáo riêng từng người ở bước khác, khi bắt đầu làm bài).
- Số lượng câu hỏi chung/riêng là do Người ra đề khai báo thủ công lúc tạo đề xuất (`commonQuestionCount`, `departmentQuestionCount`), hệ thống không tự đề xuất con số này.
- Cơ chế "bù qua lại" giữa 2 pool câu hỏi là một quyết định thiết kế có chủ đích, đánh đổi giữa "đúng tuyệt đối số câu riêng đã khai báo" và "đảm bảo mọi phòng ban đều có đủ đề để thi" — ưu tiên vế sau.
