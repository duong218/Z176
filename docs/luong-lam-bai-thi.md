# Luồng làm bài thi

## Nguồn

| File | Vai trò |
|---|---|
| `server/src/services/exam-attempt.service.js` | Toàn bộ nghiệp vụ: bắt đầu/tiếp tục lượt thi, lưu tạm đáp án, giữ phiên sống, nộp bài, chấm điểm, tự động nộp khi bỏ đi. |
| `server/src/controllers/exam-attempt.controller.js` | Nhận request HTTP, gọi service tương ứng, ghi audit log cho các sự kiện quan trọng. |
| `server/src/routes/exam-attempt.routes.js` | Khai báo endpoint, áp xác thực + giới hạn tần suất gọi. |
| `client/src/components/ExamModal.jsx` | Toàn bộ giao diện và luồng tương tác phía thí sinh — từ xác nhận thông tin, làm bài, đến xem kết quả. |

## Bài toán nghiệp vụ

Thí sinh làm bài thi trắc nghiệm có giới hạn thời gian, chỉ có **1 lượt thi chính thức** (trừ khi được Người duyệt đề cấp thêm). Bài toán đặt ra nhiều tình huống thực tế cần xử lý:

- Thí sinh mất mạng hoặc lỡ tải lại trang giữa chừng — không được mất lượt thi hay mất đáp án đã chọn.
- Thí sinh đổi thiết bị giữa chừng (ví dụ máy tính bị treo, chuyển sang điện thoại) — vẫn phải làm tiếp đúng lượt thi đó, với đúng các câu đã chọn trước đó.
- Thí sinh bỏ đi giữa chừng (đóng trình duyệt, mất điện, cố tình không nộp bài để "câu giờ") — hệ thống phải tự phát hiện và tự nộp bài, không cho treo lượt thi vô thời hạn.
- Điểm số phải luôn được chấm bởi server, không bao giờ tin số liệu từ phía trình duyệt gửi lên.

## Endpoint liên quan

| Method | Đường dẫn | Vai trò | Giới hạn tần suất |
|---|---|---|---|
| `GET` | `/api/exam-attempts/my-exam` | Lấy đề thi + trạng thái lượt thi hiện tại của người đang đăng nhập | Không |
| `POST` | `/api/exam-attempts/start` | Bắt đầu lượt thi mới, hoặc tiếp tục lượt đang dở | Có |
| `PATCH` | `/api/exam-attempts/:id/answer` | Lưu tạm 1 câu trả lời (gọi mỗi lần thí sinh chọn/đổi đáp án) | Có |
| `POST` | `/api/exam-attempts/:id/heartbeat` | Báo hiệu "tôi vẫn đang ở đây", gọi định kỳ trong lúc làm bài | Có |
| `POST` | `/api/exam-attempts/:id/submit` | Nộp bài chính thức, chấm điểm | Có |

Tất cả route đều yêu cầu đăng nhập, đúng vai trò `candidate`, và đã đổi mật khẩu mặc định. Giới hạn tần suất (100 request/phút/IP) chỉ bật khi chạy ở môi trường production, tắt ở môi trường phát triển để không cản trở việc test.

## Luồng chi tiết

### 1. Mở màn hình thi — `getMyExam`

Khi thí sinh mở modal thi (`ExamModal.jsx`), việc đầu tiên xảy ra là gọi `GET /my-exam`. Hàm `getMyExam` trong service làm các việc sau, theo đúng thứ tự:

1. Xác định nhân viên + kỳ thi đang published + đề đã được gán cho nhân viên đó (`resolveCandidateContext`). Nếu tài khoản chưa liên kết hồ sơ nhân viên, chưa có kỳ thi nào đang diễn ra, hoặc chưa được gán đề — trả lỗi rõ ràng tương ứng, chặn ngay từ bước này.
2. Lấy toàn bộ các lượt thi chính thức trước đó của thí sinh này. Với mỗi lượt, kiểm tra nếu đang "in_progress" mà đã quá hạn giờ (`expiresAt`) thì tự chuyển sang trạng thái "expired".
3. Nếu có 1 lượt đang "in_progress": kiểm tra xem thí sinh có bị coi là **đã bỏ đi quá 1 phút** không (xem mục "Cơ chế tự động nộp bài" bên dưới). Nếu đúng, lượt đó sẽ bị tự động nộp ngay trong lần gọi này, và kết quả trả về sẽ kèm cờ `autoSubmitted` để giao diện hiển thị đúng thông báo.
4. Nếu vẫn còn 1 lượt "in_progress" hợp lệ sau bước kiểm tra: cập nhật lại `lastActiveAt` (mốc thời gian "còn hoạt động" gần nhất) và tính lại xem thí sinh còn được phép làm bài không (`canTake`).
5. Trả về đề thi:
   - Nếu đang có lượt "in_progress" (thí sinh quay lại làm tiếp): trả đúng **bộ câu hỏi đã xáo riêng cho lượt thi này** (đọc từ snapshot đã lưu lúc bắt đầu, xem mục "Xáo câu hỏi riêng cho từng lượt thi"), kèm toàn bộ đáp án đã lưu tạm trước đó (`savedAnswers`) — đây chính là cơ chế cho phép thí sinh đổi thiết bị giữa chừng mà vẫn thấy đúng các lựa chọn cũ.
   - Nếu chưa bắt đầu (màn xác nhận trước khi thi): trả đề theo thứ tự mặc định của phòng ban, chỉ để xem trước — thứ tự thật sự chỉ được xáo khi bấm "Bắt đầu thi".

### 2. Bắt đầu / tiếp tục lượt thi — `startAttempt`

Khi thí sinh bấm nút "Bắt đầu thi" (hoặc "Tiếp tục bài thi đang dở"), client gọi `POST /start`.

- Nếu đang có 1 lượt "in_progress" còn hạn: **không tạo lượt mới**, chỉ cập nhật `lastActiveAt` rồi trả về đúng lượt đó (đánh dấu `resumed: true`). Đây là lý do thí sinh lỡ tải lại trang hoặc thoát app giữa chừng không bị mất lượt thi.
- Nếu chưa có lượt nào đang dở: kiểm tra số lượt đã hoàn thành có còn dưới giới hạn cho phép không (mặc định 1 lượt, cộng thêm số lượt được Người duyệt đề cấp riêng nếu có). Nếu đã hết lượt, chặn lại và báo lỗi.
- Nếu còn lượt: tạo 1 bản ghi lượt thi mới, tính `expiresAt` = thời điểm bắt đầu + số phút quy định của kỳ thi, rồi sinh snapshot câu hỏi xáo riêng cho lượt thi này (xem mục dưới).

### 3. Xáo câu hỏi riêng cho từng lượt thi (`AttemptQuestion`)

Đây là điểm khác biệt quan trọng so với "sinh đề tự động" (xem tài liệu `sinh-de-tu-dong.md`): việc sinh đề theo phòng ban tạo ra **1 bộ câu hỏi cố định dùng chung cho cả phòng ban** (`ExamCode` + `ExamCodeQuestion`). Còn ở bước này, mỗi khi 1 thí sinh thực sự bắt đầu 1 lượt thi mới, hệ thống lấy đúng bộ câu hỏi đó của phòng ban, **xáo lại thứ tự câu hỏi và thứ tự đáp án riêng cho lượt thi của cá nhân đó**, rồi lưu thành 1 bản ghi `AttemptQuestion` riêng — mục đích để 2 thí sinh cùng phòng ban ngồi cạnh nhau sẽ thấy câu hỏi hiện theo thứ tự khác nhau, hạn chế việc nhìn bài nhau qua thứ tự câu/đáp án giống hệt.

Việc xáo này **chỉ xảy ra đúng 1 lần** khi tạo lượt thi mới, không xáo lại khi thí sinh resume (tiếp tục lượt đang dở) — đảm bảo xuyên suốt 1 lượt thi, thứ tự câu hỏi luôn giữ nguyên, kể cả khi đổi thiết bị.

### 4. Trong lúc làm bài — lưu tạm đáp án (`recordAnswer`)

Mỗi lần thí sinh chọn hoặc đổi đáp án một câu, client gọi `PATCH /:id/answer`. Hàm `recordAnswer`:

1. Xác định đúng chủ sở hữu lượt thi (đối chiếu `attemptId` với `examCandidateId` suy ra từ tài khoản đang đăng nhập) — không tin `attemptId` suông từ client, tránh việc sửa đáp án của người khác.
2. Kiểm tra lượt thi có quá hạn giờ hoặc bị coi là đã bỏ đi quá lâu không — nếu có, lượt thi sẽ bị tự động nộp ngay tại đây, và trả lỗi để client biết dừng lại, không cho ghi đáp án vào 1 lượt thi đã kết thúc.
3. Ghi đè đáp án đã chọn cho đúng câu hỏi đó (thao tác "upsert" — nếu câu này chưa từng lưu thì tạo mới, nếu đã có thì cập nhật lại) vào bảng `CandidateAnswer`. **Không tính điểm ở bước này** — đúng/sai chỉ được chấm thật vào lúc nộp bài.
4. Cập nhật lại `lastActiveAt` — vì đây cũng là 1 dấu hiệu "thí sinh vẫn đang hoạt động", tính vào việc phát hiện bỏ đi giống heartbeat.

Song song, phía client (`ExamModal.jsx`) còn lưu tạm đáp án vào `localStorage` của trình duyệt ngay khi chọn — đây chỉ là lớp dự phòng cho tình huống mất mạng tạm thời trước khi request lưu lên server kịp gửi đi, **không phải nguồn dữ liệu đáng tin để tính điểm**; nguồn sự thật duy nhất để chấm điểm và để khôi phục khi đổi thiết bị luôn là dữ liệu đã lưu ở server.

### 5. Giữ phiên "còn sống" — heartbeat

Trong lúc thí sinh đang làm bài và tab đang hiển thị, client tự động gọi `POST /:id/heartbeat` định kỳ mỗi 15 giây (`ExamModal.jsx`), và gọi thêm ngay khi tab vừa được mở lại sau khi từng bị ẩn. Việc gọi heartbeat **chỉ diễn ra khi `document.visibilityState === 'visible'`** — tức là khi thí sinh chuyển sang tab khác, heartbeat sẽ tự ngừng gửi, đúng như tên gọi "nhịp tim" của phiên làm bài.

Hàm `heartbeat` phía server cũng kiểm tra lượt thi có bị coi là đã bỏ đi quá lâu không (giống bước 2 ở `recordAnswer`) — nếu có, tự nộp bài ngay, và trả về lý do (`autoSubmitReason`) để client hiển thị đúng thông báo cho thí sinh.

### 6. Cơ chế tự động nộp bài khi thí sinh bỏ đi (`checkAndAutoSubmitIfInactive`)

Đây là lớp bảo vệ cốt lõi để tránh 1 lượt thi bị treo vô thời hạn. Logic:

- Mỗi lượt thi có 1 mốc `lastActiveAt` — thời điểm gần nhất server nhận được **bất kỳ** hoạt động nào từ thí sinh (gọi `getMyExam`, `recordAnswer`, hoặc `heartbeat`).
- Nếu khoảng cách từ `lastActiveAt` đến hiện tại vượt quá **1 phút**, lượt thi bị coi là "đã bỏ đi" và tự động bị nộp ngay, với lý do `inactive_timeout`.
- Nếu lượt thi **chưa từng có** `lastActiveAt` (vừa mới bắt đầu, chưa kịp có hoạt động nào) thì **không** bị tính là bỏ đi — tránh nộp oan 1 lượt thi vừa mới khởi tạo.
- Hàm kiểm tra này được gọi ở **cả 3 điểm vào** có thể nhận request cho 1 lượt thi (`getMyExam`, `recordAnswer`, `heartbeat`) — đảm bảo phát hiện được tình trạng "bỏ đi" dù thí sinh thao tác lại từ bất kỳ thiết bị nào, không riêng thiết bị đã bỏ đi.

Khi tự động nộp, hệ thống gọi lại đúng hàm nộp bài thật (`submitAttempt`) nhưng **không có đáp án đi kèm từ request** (vì không có request thật nào cả) — khi đó hàm nộp bài sẽ tự lấy đáp án từ những gì đã được lưu tạm qua `recordAnswer` trong bảng `CandidateAnswer`. Đây chính là lý do cơ chế lưu tạm đáp án ở bước 4 bắt buộc phải tồn tại — nếu không có nó, tự động nộp bài sẽ không biết chấm dựa trên đáp án nào.

**Lưu ý về lớp cảnh báo bổ sung phía giao diện:** Ngoài cơ chế 1 phút "âm thầm" này ở backend, phía `ExamModal.jsx` còn có thêm 1 lớp cảnh báo **hiển thị rõ ràng cho thí sinh thấy ngay**: khi phát hiện thí sinh chuyển tab/ứng dụng khác (qua sự kiện `visibilitychange` và `blur` của trình duyệt), giao diện hiện overlay cảnh báo kèm đếm ngược 10 giây; nếu không quay lại kịp, giao diện tự gọi nộp bài với đáp án hiện có. Lớp này hoàn toàn độc lập với cơ chế 1 phút phía backend — không thay thế nó, chỉ bổ sung thêm để thí sinh **biết trước** và có cơ hội quay lại kịp thời trước khi bị nộp bài, thay vì bị nộp một cách "im lặng" sau 1 phút mà không có cảnh báo nào.

### 7. Nộp bài và chấm điểm — `submitAttempt`

Xảy ra khi thí sinh tự bấm "Nộp bài thi" (`POST /:id/submit` với đáp án gửi kèm từ client), hoặc khi hệ thống tự động nộp (gọi nội bộ, không có đáp án gửi kèm — xem mục 6).

1. Nếu lượt thi **đã** ở trạng thái "submitted" từ trước (ví dụ thí sinh bấm nộp 2 lần liên tiếp) — trả lại đúng kết quả đã chấm trước đó, **không chấm lại**, không tạo thêm bản ghi kết quả mới. Đây là tính chất "idempotent" (gọi lại nhiều lần vẫn cho cùng 1 kết quả, không gây tác dụng phụ).
2. Lấy đúng danh sách câu hỏi thuộc snapshot riêng của lượt thi này (`AttemptQuestion`) — chấm theo đúng bộ câu thí sinh đã thực sự nhìn thấy, không phải theo bộ câu gốc của phòng ban.
3. Lấy đáp án đúng thật sự của từng câu (`Answer` có `isCorrect: true`) — dữ liệu này **không bao giờ** được gửi ra phía client trong suốt quá trình làm bài.
4. Xác định đáp án thí sinh đã chọn: nếu là nộp bài bình thường thì dùng đúng payload gửi lên; nếu là tự động nộp thì lấy từ dữ liệu đã autosave trong `CandidateAnswer`.
5. Với mỗi câu, so sánh tập đáp án đã chọn với tập đáp án đúng (khớp hoàn toàn thì tính đúng — kể cả câu nhiều đáp án cũng phải chọn đúng và đủ, không thừa không thiếu).
6. Tính điểm theo phần trăm số câu đúng, so với ngưỡng đạt của kỳ thi (`passThresholdPercent`) để xác định đạt/không đạt.
7. Ghi lại toàn bộ đáp án đã chấm vào `CandidateAnswer` (xoá dữ liệu autosave cũ trước khi ghi lại, để không vi phạm ràng buộc dữ liệu duy nhất theo từng câu hỏi trong 1 lượt thi), đóng lượt thi (chuyển trạng thái "submitted"), và tạo 1 bản ghi `Result` chứa điểm số cuối cùng.

## Luồng phía giao diện (`ExamModal.jsx`)

Modal thi vận hành theo các bước (`step`) nối tiếp nhau:

`loading` (đang tải dữ liệu) → `confirm` (xác nhận thông tin + xem trước đề) → `testing` (đang làm bài) → `submitting` (đang gửi bài) → `result` (xem kết quả), hoặc có thể rẽ sang `auto-submitted` (bị hệ thống tự nộp) hoặc `error` (không tải được dữ liệu) ở các điểm phù hợp.

Trong bước `testing`:
- Đồng hồ đếm ngược hiển thị luôn tính theo `expiresAt` thật lấy từ server (không tự đếm lùi theo đồng hồ máy khách), nên hết giờ là tự động gọi nộp bài đúng lúc, không lệch dù máy thí sinh chỉnh sai giờ.
- Có màn hình danh sách câu hỏi dạng lưới để nhảy nhanh giữa các câu, hiển thị rõ câu nào đã chọn/chưa chọn.
- Trước khi nộp bài, nếu còn câu chưa trả lời, giao diện hiện xác nhận lại — tránh bấm nhầm nộp bài khi chưa làm hết.
- Nếu bị nộp bài do phát hiện đã ngừng hoạt động quá 1 phút (từ heartbeat hoặc từ `recordAnswer` báo lỗi `ATTEMPT_INVALID_STATUS`), chuyển thẳng sang màn `auto-submitted` với thông báo giải thích rõ lý do.

## Giới hạn / lưu ý khi viết báo cáo

- Hệ thống có **2 lớp phát hiện "thí sinh bỏ đi"** hoạt động song song, độc lập nhau: lớp 1 phút "âm thầm" ở backend (không thể tắt/qua mặt từ phía client vì server tự tính dựa trên thời gian nhận request), và lớp cảnh báo 10 giây có UI rõ ràng ở frontend (thuần trải nghiệm người dùng, không phải lớp bảo mật). Nên nhấn mạnh rõ 2 lớp này khi trình bày, tránh gây hiểu nhầm là chỉ có 1 cơ chế.
- Điểm số luôn được chấm lại hoàn toàn ở server dựa trên dữ liệu đã lưu, không tin bất kỳ số liệu điểm/đúng-sai nào gửi từ client — kể cả trong trường hợp client bị can thiệp (sửa code JS, gọi thẳng API) cũng không thể tự khai điểm.
- Việc chỉ cho phép 1 lượt thi chính thức (có thể mở rộng qua cơ chế cấp thêm lượt của Người duyệt đề) là quy tắc nghiệp vụ được thiết kế cứng ở tầng service (`MAX_OFFICIAL_ATTEMPTS`), không phải giới hạn UI — gọi thẳng API cũng không vượt qua được.
