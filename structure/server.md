# Cấu trúc server

## Phạm vi

`server/` là API Express dùng MongoDB/Mongoose, Node `>=22 <25`. Xác thực JWT (access token + refresh token httpOnly cookie), mã hoá mật khẩu bcrypt, upload file qua Multer + Cloudinary, xử lý Excel bằng exceljs/xlsx, bảo mật với Helmet + CORS + rate limiting. Tài liệu phản ánh mã nguồn hiện có; mọi thay đổi schema, xác thực và phân quyền vẫn cần được rà soát theo quy ước dự án trước khi triển khai dữ liệu thật.

```text
server/
├── .env.example                                    # Mẫu biến môi trường (không chứa giá trị thật)
├── package.json                                    # Dependencies & scripts (dev, start, seed, backup)
├── package-lock.json                               # Lockfile npm
├── test_rate_limit.js                              # Script kiểm tra thủ công rate limiting
└── src/
    ├── app.js                                      # Khởi tạo Express app: Helmet, CORS, cookie parser, JSON, routes, error handler
    ├── index.js                                    # Entry point: kiểm tra env, kết nối MongoDB, chạy seed, khởi động server
    ├── config/
    │   ├── db.js                                   # Kết nối MongoDB qua Mongoose
    │   └── env.js                                  # Validate & export biến môi trường (port, JWT secrets, DB URI, CORS origin, Cloudinary...)
    ├── controllers/
    │   ├── audit.controller.js                     # Xử lý request lấy danh sách audit log (phân trang, lọc)
    │   ├── auth.controller.js                      # Xử lý request đăng nhập, refresh token, đăng xuất, lấy thông tin user, đổi mật khẩu
    │   ├── backup.controller.js                    # Xử lý request sao lưu: danh sách bản lưu trên Drive, tải về, khôi phục từ file .gz
    │   ├── department.controller.js                # Xử lý request CRUD phòng ban
    │   ├── exam.controller.js                      # Xử lý request kỳ thi: tạo, đệ trình, duyệt, từ chối, phát hành, lưu trữ, lấy active
    │   ├── exam-attempt.controller.js              # Xử lý request lượt thi: lấy đề, bắt đầu, nộp bài, autosave, heartbeat, cấp thêm lượt
    │   ├── notification.controller.js              # Xử lý request thông báo: danh sách, đếm chưa đọc, đánh dấu đã đọc
    │   ├── question.controller.js                  # Xử lý request câu hỏi: CRUD, import Excel, upload ảnh, thống kê, xóa hàng loạt
    │   ├── report.controller.js                    # Xử lý request báo cáo: tổng quan, theo phòng ban, theo kỳ thi, chi tiết, xuất Excel, tra cứu công khai
    │   ├── role.controller.js                      # Xử lý request lấy danh sách role
    │   ├── study-document.controller.js            # Xử lý request tài liệu ôn tập: CRUD, xem/tải file, danh sách cho thí sinh
    │   ├── topic.controller.js                     # Xử lý request CRUD chủ đề
    │   └── user.controller.js                      # Xử lý request CRUD user, import Excel 2 bước, xuất Excel tài khoản, phân role, khóa/mở, reset password
    ├── middlewares/
    │   ├── auth.middleware.js                       # Xác thực JWT (authenticate), kiểm tra role (requireRoleCodes), kiểm tra tokenVersion
    │   ├── rate-limit.middleware.js                 # Giới hạn tần suất: loginRateLimiter (đăng nhập), examAttemptRateLimiter (thao tác thi)
    │   ├── require-password-changed.middleware.js   # Chặn truy cập nếu user chưa đổi mật khẩu lần đầu (mustChangePassword)
    │   └── upload.middleware.js                     # Upload file qua Multer: uploadExcel (import câu hỏi/nhân viên), uploadQuestionImage (ảnh câu hỏi → Cloudinary), uploadStudyDocument (tài liệu ôn tập → Cloudinary)
    ├── models/
    │   ├── index.js                                # Re-export tất cả model + constants
    │   ├── constants.js                            # Enum constants: QUESTION_SCOPE, QUESTION_KIND, ANSWER_TYPE, DIFFICULTY, EXAM_STATUS, ATTEMPT_TYPE, ATTEMPT_STATUS, DOCUMENT_SCOPE
    │   ├── answer.model.js                         # Đáp án câu hỏi: nội dung, đúng/sai, thuộc question nào
    │   ├── attempt-question.model.js               # Câu hỏi trong lượt thi: mapping câu hỏi + đáp án vào từng lượt thi cụ thể
    │   ├── audit-log.model.js                      # Nhật ký hệ thống: hành động, người thực hiện, thời gian, chi tiết
    │   ├── candidate-answer.model.js               # Đáp án thí sinh chọn: mapping lượt thi + câu hỏi + đáp án đã chọn
    │   ├── department.model.js                     # Phòng ban: tên, mã, mô tả, trạng thái, số nhân viên
    │   ├── employee.model.js                       # Nhân viên: họ tên, mã nhân viên, phòng ban, chức vụ, liên kết user
    │   ├── exam.model.js                           # Kỳ thi: tiêu đề, chủ đề, cấu hình (số câu, thời gian, điểm đạt), trạng thái workflow (draft → pending → approved → published → archived)
    │   ├── exam-attempt.model.js                   # Lượt thi: thí sinh, kỳ thi, trạng thái (in_progress/submitted/expired), loại (practice/official), thời gian bắt đầu/kết thúc, lastHeartbeat
    │   ├── exam-candidate.model.js                 # Thí sinh tham gia kỳ thi: mapping user + exam, mã đề thi, số lượt thi đã dùng/tối đa
    │   ├── exam-code.model.js                      # Mã đề thi: mã đề, thuộc kỳ thi nào (đảo thứ tự câu hỏi/đáp án)
    │   ├── exam-code-question.model.js             # Câu hỏi trong mã đề: mapping mã đề + câu hỏi + thứ tự
    │   ├── notification.model.js                   # Thông báo: người nhận, tiêu đề, nội dung, loại, đã đọc/chưa, thời gian
    │   ├── question.model.js                       # Câu hỏi trắc nghiệm: nội dung, ảnh minh hoạ, chủ đề, phòng ban, độ khó, phạm vi, loại (lý thuyết/thực hành), kiểu trả lời (đơn/nhiều)
    │   ├── result.model.js                         # Kết quả thi: thí sinh, kỳ thi, điểm, đạt/không đạt, lượt thi
    │   ├── role.model.js                           # Vai trò: mã (admin/examiner/leader/candidate), tên hiển thị
    │   ├── schedule.model.js                       # Lịch thi: kỳ thi, thời gian bắt đầu/kết thúc
    │   ├── study-document.model.js                 # Tài liệu ôn tập: tiêu đề, chủ đề, phạm vi, phòng ban, file (Cloudinary URL), người upload
    │   ├── topic.model.js                          # Chủ đề thi: tên chủ đề
    │   └── user.model.js                           # Tài khoản: username, password hash, role, trạng thái khóa, mustChangePassword, tokenVersion
    ├── routes/
    │   ├── index.js                                # Router gốc: mount tất cả sub-router vào /api/*
    │   ├── auth.routes.js                          # Route xác thực: login, refresh, logout, me, change-password
    │   ├── backup.routes.js                        # Route quản lý backup: danh sách, tải về, restore (chỉ admin)
    │   ├── audit.routes.js                         # Route audit log (chỉ admin)
    │   ├── department.routes.js                    # Route CRUD phòng ban (admin, examiner)
    │   ├── exam.routes.js                          # Route kỳ thi: active (public), CRUD + workflow (examiner/leader)
    │   ├── exam-attempt.routes.js                  # Route lượt thi thí sinh + cấp thêm lượt (leader)
    │   ├── notification.routes.js                  # Route thông báo (mọi role đã đăng nhập)
    │   ├── question.routes.js                      # Route ngân hàng câu hỏi (admin, examiner)
    │   ├── report.routes.js                        # Route báo cáo: public lookup, my-results (candidate), tổng hợp (leader/admin)
    │   ├── role.routes.js                          # Route lấy danh sách role (chỉ admin)
    │   ├── study-document.routes.js                # Route tài liệu ôn tập: quản lý (admin/examiner) + xem (candidate)
    │   ├── topic.routes.js                         # Route CRUD chủ đề (admin, examiner)
    │   └── user.routes.js                          # Route quản lý user: CRUD, import/export Excel, phân role, khóa/mở, reset password (chỉ admin)
    ├── scripts/
    │   ├── backup-cli.js                           # CLI sao lưu cơ sở dữ liệu thủ công (dump -> upload Drive và xoay vòng)
    │   ├── cleanup-tmp-employees.js                # Script dọn dẹp nhân viên tạm (dữ liệu thừa từ import)
    │   ├── get-google-refresh-token.js             # Script chạy một lần để cấp Refresh Token cho Google Drive OAuth2 cá nhân
    │   └── seed-cli.js                             # CLI tạo dữ liệu seed: role mặc định + tài khoản admin ban đầu
    ├── services/
    │   ├── audit.service.js                        # Nghiệp vụ audit: ghi log hành động, truy vấn/lọc/phân trang audit log
    │   ├── auth.service.js                         # Nghiệp vụ xác thực: verify password, tạo/verify JWT, refresh token (httpOnly cookie), tăng tokenVersion khi login mới
    │   ├── backup.service.js                       # Nghiệp vụ sao lưu: dump database ra file .gz, upload lên Drive cá nhân thông qua Google OAuth2, dọn dẹp, tải về và khôi phục (restore)
    │   ├── backup.scheduler.js                     # Cron scheduler: backup tự động hàng ngày lúc 3h sáng, giữ tối đa 5 bản lưu
    │   ├── department.service.js                   # Nghiệp vụ phòng ban: CRUD, kiểm tra trùng mã, đếm nhân viên
    │   ├── exam.service.js                         # Nghiệp vụ kỳ thi: tạo đề xuất, đệ trình, duyệt/từ chối/phát hành/lưu trữ, lấy kỳ thi active
    │   ├── exam-attempt.service.js                 # Nghiệp vụ lượt thi: lấy đề + trạng thái, bắt đầu/resume, nộp bài + chấm điểm, autosave, heartbeat + tự nộp khi rời 1 phút, cấp thêm lượt
    │   ├── exam-code-generation.service.js         # Nghiệp vụ sinh mã đề: tạo nhiều mã đề với thứ tự câu hỏi/đáp án ngẫu nhiên khi phát hành kỳ thi
    │   ├── notification.service.js                 # Nghiệp vụ thông báo: tạo thông báo theo sự kiện hệ thống, truy vấn, đánh dấu đã đọc
    │   ├── question.service.js                     # Nghiệp vụ câu hỏi: CRUD, import từ Excel (validate từng dòng), upload ảnh lên Cloudinary, thống kê theo chủ đề, xóa hàng loạt
    │   ├── report.service.js                       # Nghiệp vụ báo cáo: tổng quan hệ thống, theo phòng ban, theo kỳ thi, kết quả chi tiết, xuất Excel (exceljs), tra cứu công khai, lịch sử thí sinh
    │   ├── role.service.js                         # Nghiệp vụ role: truy vấn danh sách role
    │   ├── seed.service.js                         # Nghiệp vụ seed: tạo 4 role mặc định (admin/examiner/leader/candidate) + tài khoản admin ban đầu
    │   ├── study-document.service.js               # Nghiệp vụ tài liệu ôn tập: upload lên Cloudinary, CRUD, phân quyền phòng ban cho candidate
    │   ├── topic.service.js                        # Nghiệp vụ chủ đề: CRUD, kiểm tra trùng tên
    │   └── user.service.js                         # Nghiệp vụ user: CRUD, import Excel 2 bước (preview phân loại → confirm ghi DB), xuất Excel tài khoản kèm mật khẩu tạm (reset + generate), phân role, khóa/mở, reset password
    └── utils/
        ├── api-error.js                            # Class ApiError: mã HTTP + error code tùy chỉnh
        └── async-handler.js                        # Wrapper try/catch cho async route handler, tự chuyển lỗi vào error middleware
```

## Thành phần và API

### Kiến trúc tổng quan

| Nhóm | Chức năng |
|---|---|
| `app.js` | Khởi tạo Express app: Helmet (bảo mật headers), CORS (origin theo env), cookie parser, JSON body (2MB limit), mount routes, handler 404, error middleware (ẩn lỗi nội bộ ở production). |
| `index.js` | Entry point: validate env, kết nối MongoDB, chạy seed nếu `SEED_ON_START=true` (tạo roles + admin), **khởi động cron backup tự động (3h sáng)**, khởi động server. |
| `config/db.js` | Kết nối MongoDB qua Mongoose. |
| `config/env.js` | Validate & export tất cả biến môi trường: port, JWT secrets/TTL, MongoDB URI, CORS origin, Cloudinary config, seed config, **thông tin Google OAuth2 credentials (Client ID, Client Secret, Refresh Token) cho Drive cá nhân**. `assertRuntimeEnv()` kiểm tra đủ biến bắt buộc khi startup. |

### Middleware

| Middleware | Chức năng |
|---|---|
| `auth.middleware.js` | `authenticate`: verify access token JWT, kiểm tra `tokenVersion` (phát hiện đăng nhập nơi khác), gắn `req.user`. `requireRoleCodes(...codes)`: kiểm tra role của user có nằm trong danh sách cho phép. |
| `rate-limit.middleware.js` | `loginRateLimiter`: giới hạn số lần đăng nhập (chỉ bật ở production). `examAttemptRateLimiter`: giới hạn tần suất thao tác thi (start, submit, answer, heartbeat). |
| `require-password-changed.middleware.js` | Chặn truy cập API nghiệp vụ nếu user chưa đổi mật khẩu mặc định (`mustChangePassword = true`). |
| `upload.middleware.js` | Multer config: `uploadExcel` (nhận file .xlsx/.xls, lưu tạm), `uploadQuestionImage` (ảnh câu hỏi → Cloudinary), `uploadStudyDocument` (tài liệu ôn tập → Cloudinary). |

### Models (Mongoose)

| Model | Chức năng |
|---|---|
| `Role` | Vai trò: `code` (admin/examiner/leader/candidate), tên hiển thị. |
| `User` | Tài khoản: username, password hash (bcrypt), role ref, trạng thái khóa, `mustChangePassword`, `tokenVersion` (tăng mỗi lần login mới để thu hồi phiên cũ). |
| `Employee` | Nhân viên: họ tên, mã nhân viên, phòng ban ref, chức vụ, liên kết user. |
| `Department` | Phòng ban: tên, mã, mô tả, trạng thái active. |
| `Topic` | Chủ đề thi: tên chủ đề. |
| `Question` | Câu hỏi trắc nghiệm: nội dung, ảnh minh hoạ (Cloudinary URL), chủ đề ref, phòng ban ref, độ khó (easy/medium/hard), phạm vi (Common/DepartmentSpecific), loại (theory/practice), kiểu trả lời (single/multiple). |
| `Answer` | Đáp án: nội dung, đúng/sai, thuộc question ref. |
| `Exam` | Kỳ thi: tiêu đề, chủ đề ref, cấu hình (số câu theo độ khó, thời gian, điểm đạt, số lượt thi), trạng thái workflow (draft → pending_review → approved → published → archived), người tạo/duyệt. |
| `ExamCode` | Mã đề thi: mã đề, thuộc exam ref (mỗi kỳ thi sinh nhiều mã đề, đảo thứ tự câu hỏi/đáp án). |
| `ExamCodeQuestion` | Câu hỏi trong mã đề: mapping mã đề + câu hỏi + thứ tự hiển thị. |
| `ExamCandidate` | Thí sinh tham gia kỳ thi: mapping user + exam, mã đề được phân, số lượt thi đã dùng/tối đa. |
| `ExamAttempt` | Lượt thi: thí sinh ref, kỳ thi ref, trạng thái (in_progress/submitted/expired), loại (practice/official), thời gian bắt đầu/kết thúc, `lastHeartbeat`. |
| `AttemptQuestion` | Câu hỏi trong lượt thi: mapping lượt thi + câu hỏi + đáp án đã chọn (autosave). |
| `CandidateAnswer` | Đáp án thí sinh: mapping lượt thi + câu hỏi + đáp án đã chọn (lưu khi nộp bài). |
| `Result` | Kết quả thi: thí sinh, kỳ thi, lượt thi, điểm, đạt/không đạt. |
| `StudyDocument` | Tài liệu ôn tập: tiêu đề, chủ đề ref, phạm vi (Common/DepartmentSpecific), phòng ban ref, file (Cloudinary URL + public_id), người upload. |
| `Schedule` | Lịch thi: kỳ thi ref, thời gian bắt đầu/kết thúc. |
| `AuditLog` | Nhật ký: hành động, người thực hiện ref, thời gian, chi tiết (JSON). |
| `Notification` | Thông báo: người nhận ref, tiêu đề, nội dung, loại, đã đọc/chưa. |
| `constants.js` | Enum constants: `QUESTION_SCOPE`, `QUESTION_KIND`, `ANSWER_TYPE`, `DIFFICULTY`, `EXAM_STATUS`, `ATTEMPT_TYPE`, `ATTEMPT_STATUS`, `DOCUMENT_SCOPE`. |

### Services (Nghiệp vụ)

| Service | Chức năng |
|---|---|
| `audit.service.js` | Ghi log hành động hệ thống (CRUD user, kỳ thi, câu hỏi...), truy vấn/lọc/phân trang audit log. |
| `auth.service.js` | Verify password (bcrypt), tạo access token + refresh token (JWT), set refresh token vào httpOnly cookie, verify/decode token, tăng `tokenVersion` khi đăng nhập mới (thu hồi phiên cũ). |
| `department.service.js` | CRUD phòng ban, kiểm tra trùng mã, đếm nhân viên thuộc phòng ban. |
| `exam.service.js` | Tạo đề xuất kỳ thi (draft), đệ trình (pending_review), duyệt/từ chối/phát hành/lưu trữ, lấy kỳ thi active (published + trong khoảng thời gian). |
| `exam-attempt.service.js` | Lấy đề thi + trạng thái lượt thi (ẩn đáp án đúng), bắt đầu/resume lượt thi, nộp bài + chấm điểm tự động, autosave đáp án, heartbeat giữ phiên (tự nộp bài khi rời ca thi >1 phút), cấp thêm lượt thi chính thức (leader). |
| `exam-code-generation.service.js` | Sinh mã đề khi phát hành kỳ thi: tạo nhiều mã đề với thứ tự câu hỏi/đáp án ngẫu nhiên, phân mã đề cho thí sinh. |
| `notification.service.js` | Tạo thông báo theo sự kiện (kỳ thi được duyệt/phát hành, kết quả thi...), truy vấn, đánh dấu đã đọc, đánh dấu tất cả đã đọc. |
| `question.service.js` | CRUD câu hỏi (kèm đáp án), import hàng loạt từ Excel (validate từng dòng, báo lỗi cụ thể), upload ảnh minh hoạ lên Cloudinary, thống kê câu hỏi theo chủ đề, xóa hàng loạt. |
| `report.service.js` | Tổng quan hệ thống (số user/kỳ thi/câu hỏi), báo cáo theo phòng ban (tỉ lệ đạt), báo cáo theo kỳ thi, kết quả chi tiết (danh sách thí sinh + điểm), xuất Excel (exceljs với format chuyên nghiệp), tra cứu kết quả công khai, lịch sử kết quả thí sinh. |
| `role.service.js` | Truy vấn danh sách role từ DB. |
| `seed.service.js` | Tạo 4 role mặc định (admin/examiner/leader/candidate) + tài khoản admin ban đầu (từ env) khi khởi động. |
| `study-document.service.js` | Upload tài liệu lên Cloudinary (raw resource type), CRUD, phân quyền xem theo phòng ban cho candidate, stream file download/preview. |
| `topic.service.js` | CRUD chủ đề, kiểm tra trùng tên, kiểm tra phụ thuộc (có câu hỏi thuộc chủ đề không) trước khi xóa. |
| `user.service.js` | CRUD user, import Excel 2 bước (preview: đọc file + phân loại new/update/skip/conflict → confirm: ghi DB), xuất Excel tài khoản kèm mật khẩu tạm (reset mật khẩu + generate random), phân role, khóa/mở khóa, reset mật khẩu, ghi audit log. |

### Scripts

| Script | Chức năng |
|---|---|
| `scripts/seed-cli.js` | CLI tạo dữ liệu seed: `npm run seed` — tạo 4 role + admin. |
| `scripts/backup-cli.js` | CLI sao lưu: `npm run backup`. |
| `scripts/cleanup-tmp-employees.js` | Script dọn dẹp nhân viên tạm (dữ liệu thừa từ quá trình import). |

### Utils

| Util | Chức năng |
|---|---|
| `utils/api-error.js` | Class `ApiError`: kế thừa `Error`, thêm `statusCode` (HTTP status) và `code` (error code tùy chỉnh, vd `NOT_FOUND`, `UNAUTHORIZED`). |
| `utils/async-handler.js` | Wrapper `asyncHandler(fn)`: bọc async route handler trong try/catch, tự chuyển lỗi vào `next(err)` → error middleware. |

---

## Bảng API Endpoints

### `/api` — Health

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/health` | Public | Kiểm tra server hoạt động. |

### `/api/auth` — Xác thực

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `POST` | `/login` | Public (rate limited) | Đăng nhập, trả access token + set refresh cookie. |
| `POST` | `/refresh` | Public (cần refresh cookie) | Làm mới access token. |
| `POST` | `/logout` | Authenticated | Đăng xuất, xoá refresh cookie. |
| `GET` | `/me` | Authenticated | Lấy thông tin user hiện tại + role + employee. |
| `POST` | `/change-password` | Authenticated | Đổi mật khẩu (bắt buộc lần đầu). |

### `/api/users` — Quản lý tài khoản (chỉ Admin)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin | Danh sách tài khoản (có phân trang, lọc). |
| `POST` | `/` | Admin | Tạo tài khoản đơn lẻ. |
| `POST` | `/export-credentials` | Admin | Xuất Excel danh sách tài khoản candidate kèm mật khẩu tạm (reset mật khẩu). |
| `POST` | `/import/preview` | Admin | Import Excel: đọc file, phân loại từng dòng (mới/cập nhật/bỏ qua/xung đột), KHÔNG ghi DB. |
| `POST` | `/import/confirm` | Admin | Import Excel: ghi DB theo kết quả preview đã phân loại. |
| `PATCH` | `/:id/role` | Admin | Đổi role user. |
| `PATCH` | `/:id/lock` | Admin | Khóa/mở khóa tài khoản. |
| `POST` | `/:id/reset-password` | Admin | Reset mật khẩu user. |

### `/api/roles` — Danh sách role (chỉ Admin)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin | Lấy tất cả role. |

### `/api/topics` — Chủ đề (Admin, Examiner)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin, Examiner | Danh sách chủ đề. |
| `POST` | `/` | Admin, Examiner | Tạo chủ đề mới. |
| `PATCH` | `/:id` | Admin, Examiner | Cập nhật chủ đề. |
| `DELETE` | `/:id` | Admin, Examiner | Xóa chủ đề (kiểm tra phụ thuộc). |

### `/api/departments` — Phòng ban (Admin, Examiner)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin, Examiner | Danh sách phòng ban. |
| `POST` | `/` | Admin, Examiner | Tạo phòng ban mới. |
| `PATCH` | `/:id` | Admin, Examiner | Cập nhật phòng ban. |
| `DELETE` | `/:id` | Admin, Examiner | Xóa phòng ban. |

### `/api/questions` — Ngân hàng câu hỏi (Admin, Examiner)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin, Examiner | Danh sách câu hỏi (lọc, phân trang). |
| `GET` | `/:id` | Admin, Examiner | Chi tiết 1 câu hỏi + đáp án. |
| `POST` | `/` | Admin, Examiner | Tạo câu hỏi mới (kèm đáp án). |
| `PATCH` | `/:id` | Admin, Examiner | Cập nhật câu hỏi. |
| `DELETE` | `/:id` | Admin, Examiner | Xóa câu hỏi. |
| `POST` | `/import` | Admin, Examiner | Import câu hỏi từ file Excel. |
| `POST` | `/upload-image` | Admin, Examiner | Upload ảnh minh hoạ câu hỏi lên Cloudinary. |
| `GET` | `/stats/by-topic/:topicId` | Admin, Examiner | Thống kê số câu hỏi theo chủ đề (phân theo độ khó). |
| `POST` | `/bulk-delete` | Admin, Examiner | Xóa nhiều câu hỏi cùng lúc. |

### `/api/exams` — Kỳ thi

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/active` | Public | Lấy kỳ thi đang hoạt động (published + trong thời gian). |
| `GET` | `/` | Admin, Leader, Examiner | Danh sách đề xuất kỳ thi (Examiner chỉ thấy của mình). |
| `POST` | `/` | Examiner | Tạo đề xuất kỳ thi mới (draft). |
| `POST` | `/:id/submit` | Examiner | Đệ trình đề xuất lên Leader. |
| `POST` | `/:id/approve` | Leader | Duyệt đề xuất. |
| `POST` | `/:id/reject` | Leader | Từ chối đề xuất (kèm lý do). |
| `POST` | `/:id/publish` | Leader | Phát hành chính thức (sinh mã đề, gán thí sinh). |
| `POST` | `/:id/archive` | Leader | Lưu trữ kỳ thi đã kết thúc. |

### `/api/exam-attempts` — Lượt thi thí sinh

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/my-exam` | Candidate | Lấy đề thi + trạng thái lượt thi (ẩn đáp án đúng), kèm savedAnswers + autoSubmitted. |
| `POST` | `/start` | Candidate (rate limited) | Bắt đầu lượt thi mới hoặc resume lượt đang dở. |
| `POST` | `/:id/submit` | Candidate (rate limited) | Nộp bài thi + chấm điểm tự động. |
| `PATCH` | `/:id/answer` | Candidate (rate limited) | Autosave đáp án 1 câu (không chấm điểm). |
| `POST` | `/:id/heartbeat` | Candidate (rate limited) | Heartbeat giữ phiên thi, tự nộp nếu rời >1 phút. |
| `POST` | `/candidates/:examCandidateId/grant-attempt` | Leader | Cấp thêm 1 lượt thi chính thức cho thí sinh cụ thể. |

### `/api/notifications` — Thông báo (mọi role đã đăng nhập)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Authenticated | Danh sách thông báo của user. |
| `GET` | `/unread-count` | Authenticated | Đếm số thông báo chưa đọc. |
| `PATCH` | `/:id/read` | Authenticated | Đánh dấu 1 thông báo đã đọc. |
| `PATCH` | `/read-all` | Authenticated | Đánh dấu tất cả đã đọc. |

### `/api/study-documents` — Tài liệu ôn tập

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/candidate` | Candidate | Danh sách tài liệu thí sinh được xem (theo phòng ban). |
| `GET` | `/` | Admin, Examiner, Leader | Danh sách tất cả tài liệu. |
| `POST` | `/` | Admin, Examiner | Upload tài liệu mới (Multer → Cloudinary). |
| `DELETE` | `/:id` | Admin, Examiner | Xóa tài liệu. |
| `GET` | `/:id/file` | Authenticated | Xem/tải file tài liệu (mode=inline hoặc download). |

### `/api/audit-logs` — Nhật ký hệ thống (chỉ Admin)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin | Danh sách audit log (phân trang, lọc theo hành động/user/thời gian). |

### `/api/backups` — Sao lưu & Phục hồi (chỉ Admin)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/` | Admin | Xem danh sách các bản backup đang lưu trữ trên Google Drive (tối đa 5 bản). |
| `POST` | `/` | Admin | Tạo một bản sao lưu dữ liệu thủ công mới lên Google Drive và tự động xoay vòng. |
| `GET` | `/:fileId/download` | Admin | Tải một bản sao lưu cụ thể từ Google Drive về máy. |
| `POST` | `/restore` | Admin | Tải tệp sao lưu `.gz` từ máy tính lên và ghi đè, phục hồi lại toàn bộ cơ sở dữ liệu (yêu cầu confirm=RESTORE). |

### `/api/reports` — Báo cáo

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/public/by-department` | Public | Kết quả thi công khai theo phòng ban (trang chủ). |
| `GET` | `/public/lookup` | Public | Tra cứu kết quả thi cá nhân (trang chủ, theo mã nhân viên). |
| `GET` | `/my-results` | Candidate | Lịch sử kết quả thi của chính thí sinh. |
| `GET` | `/overview` | Leader, Admin | Thống kê tổng quan toàn hệ thống. |
| `GET` | `/by-department` | Leader, Admin | Báo cáo kết quả theo phòng ban. |
| `GET` | `/by-exam` | Leader, Admin | Báo cáo kết quả theo kỳ thi. |
| `GET` | `/results` | Leader, Admin | Kết quả chi tiết từng thí sinh. |
| `GET` | `/export` | Leader, Admin | Xuất Excel kết quả chi tiết. |
| `GET` | `/export-by-exam` | Leader, Admin | Xuất Excel kết quả theo kỳ thi. |

---

## Phân quyền tổng hợp

| Role | Quyền |
|---|---|
| **Public** | Xem kỳ thi active, tra cứu kết quả công khai (theo phòng ban, theo mã nhân viên), health check. |
| **Candidate** (Thí sinh) | Xem kỳ thi, tài liệu ôn tập (theo phòng ban), vào thi (start/autosave/heartbeat/submit), xem lịch sử kết quả, thông báo. |
| **Examiner** (Người ra đề) | CRUD câu hỏi/chủ đề/phòng ban, import Excel câu hỏi, upload ảnh câu hỏi, tạo + đệ trình đề xuất kỳ thi, quản lý tài liệu ôn tập, thông báo. |
| **Leader** (Người duyệt đề) | Xem tất cả đề xuất, duyệt/từ chối/phát hành/lưu trữ kỳ thi, xem báo cáo tổng hợp, xuất Excel, cấp thêm lượt thi, thông báo. |
| **Admin** (Quản trị viên) | Toàn quyền quản lý user (CRUD, import/export Excel, phân role, khóa/mở, reset password), audit log, sao lưu & phục hồi dữ liệu (Backup/Restore), quản lý câu hỏi/chủ đề/phòng ban, xem báo cáo, thông báo. |

Tất cả route nghiệp vụ (trừ Public) đều yêu cầu xác thực (`authenticate`) và đã đổi mật khẩu (`requirePasswordChanged`). Client sử dụng `VITE_API_URL` để kết nối API.

---

## Luồng xử lý dữ liệu (Data Flow)

Kiến trúc tuân thủ mô hình **Controller-Service-Repository** (Mongoose đảm nhiệm vai trò Repository).

1. **Request Lifecycle**: Client Gửi Request → Express Router → `auth.middleware` (nếu có) → `rate-limit` (nếu có) → `upload.middleware` (nếu có) → **Controller**.
2. **Controller**: Xử lý input (req.params, req.body), gọi Service xử lý nghiệp vụ, trả về HTTP status và JSON response (chuẩn format `res.json({ message, data })`). Dùng `asyncHandler` để tự động đẩy lỗi.
3. **Service**: Đảm nhận mọi logic nghiệp vụ (validate, kết nối model, tính toán, gọi external API như Cloudinary, Drive). Trả về dữ liệu sạch hoặc ném ra `ApiError`.
4. **Model/Mongoose**: Tương tác với MongoDB (thêm/sửa/xóa), validate schema cấp cơ sở dữ liệu, kích hoạt pre/post hooks.
5. **Error Handler**: Lỗi từ bất kỳ đâu bị ném sẽ rơi vào global error middleware (định nghĩa cuối cùng trong `app.js`). Middleware này log lỗi và chuẩn hóa JSON báo lỗi trước khi gửi về client.

## Kiến trúc cơ sở dữ liệu & Liên kết (Relations)

Dữ liệu được tổ chức theo tính toàn vẹn thông qua tham chiếu (Ref):

- **Tổ chức nhân sự**: `Department` (1) ↔ (N) `Employee` (1) ↔ (1) `User` ↔ (1) `Role`.
  - Một user gắn với một role cụ thể. User liên kết tới thông tin nhân sự (Employee) qua mã nhân viên.
- **Kỳ thi và Đề thi**: `Exam` (1) ↔ (N) `ExamCode` (1) ↔ (N) `ExamCodeQuestion` ↔ (1) `Question`.
  - `Exam` (Kỳ thi) là container. Khi duyệt, `ExamCode` (Mã đề thi) được sinh ra từ việc trộn ngẫu nhiên `Question`.
- **Lượt thi và Kết quả**: `User (Candidate)` ↔ `ExamCandidate` ↔ `ExamAttempt` ↔ `AttemptQuestion` ↔ `Answer`.
  - Một `ExamAttempt` lưu trạng thái (in progress/submitted), thời gian kết thúc, log heartbeat. `AttemptQuestion` lưu lại đáp án đang chọn dở. Kết thúc tạo ra `Result`.

## Quản lý Lỗi (Error Handling Strategy)

- Sử dụng `ApiError` class kế thừa `Error` có thêm `statusCode` và `code` (mã định danh).
- Ví dụ: `throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');`
- Bọc toàn bộ controller bằng `asyncHandler` để không cần khối `try/catch` dài dòng.
- Global Error Handler (`app.js`) sẽ tự map statusCode (hoặc 500 nếu lỗi server) và loại bỏ chi tiết stacktrace nếu đang ở môi trường production.

## Tiêu chuẩn Bảo mật (Security Standards)

- **Helmet**: Tự động set HTTP headers chống XSS, Clickjacking.
- **CORS**: Chỉ cho phép `VITE_API_URL` được quyền gọi API, bảo vệ resource cross-origin.
- **Rate Limit**: Áp dụng chặt chẽ cho endpoint nhạy cảm:
  - `/login`: 5 req / 15 phút (ngừa brute force).
  - `/start`, `/submit`, `/heartbeat`: Chống DDOS/spam.
- **JWT**: Sử dụng chiến lược *Access Token (ngắn hạn, trong Header)* và *Refresh Token (dài hạn, HTTP-Only Cookie)* để chống XSS đánh cắp token.
- **Mật khẩu**: Băm bằng `bcryptjs` (hash + salt), bắt buộc đổi mật khẩu khi cấp tài khoản mới.
- **Ngăn chặn phiên (Session Revocation)**: Sử dụng trường `tokenVersion` trên model `User`. Đăng nhập mới sẽ tăng phiên bản, làm access token cũ trở nên bất hợp lệ.
