# Cấu trúc client

## Phạm vi

`client/` là ứng dụng Single Page Application (SPA) xây dựng bằng React 19, Vite 6 và Tailwind CSS v4.
Hệ thống sử dụng Lenis cho smooth scroll, Lucide React cho icon, Motion cho micro-interactions, Recharts cho biểu đồ thống kê báo cáo và Google GenAI SDK. Thư mục `dist/` là đầu ra build production (không chỉnh sửa trực tiếp).

```text
client/
├── .gitignore                              # Loại trừ node_modules, dist, .env khỏi git
├── eslint.config.js                        # Cấu hình ESLint 9 cho React/JSX (hook rules, refresh plugin)
├── index.html                              # Entry HTML, mount #root, favicon logo.svg, viewport responsive
├── metadata.json                           # Metadata dự án (tên hệ thống Z176, mô tả, capabilities)
├── package.json                            # Dependencies & scripts (dev, build, lint, clean, preview)
├── package-lock.json                       # Lockfile npm
├── vite.config.js                          # Cấu hình Vite 6: @vitejs/plugin-react, @tailwindcss/vite, alias @ -> /src
├── assets/                                 # Thư mục tài nguyên tĩnh cấp root
├── public/
│   ├── images/
│   │   └── HeroSection.jpg                 # Ảnh nền hero section trang chủ
│   ├── logo/
│   │   └── logo.svg                        # Logo doanh nghiệp mặc định / favicon
│   └── templates/
│       ├── Mau_Import_Cau_Hoi_Z176.xlsx    # Mẫu Excel chuẩn import câu hỏi ngân hàng đề
│       └── Mau_Import_Nhan_Vien_Z176.xlsx  # Mẫu Excel chuẩn import danh sách nhân viên
├── src/
│   ├── App.jsx                             # Component gốc: AppShell (ToastProvider + ConfirmProvider) → App (Auth, Routing, Polling kỳ thi/phiên đăng nhập, khởi tạo Lenis)
│   ├── data.js                             # Dữ liệu tĩnh Z176: thông tin doanh nghiệp, quy chế thi, hướng dẫn thi, dữ liệu mẫu
│   ├── index.css                           # CSS gốc, import Tailwind CSS v4 (@theme tokens, custom scrollbar, animations)
│   ├── main.jsx                            # Entry point React 19: StrictMode + ErrorBoundary + AppShell
│   ├── assets/
│   │   └── images/
│   │       └── military_banner_bg_*.jpg    # Ảnh nền banner phong cách quân đội Z176
│   ├── hooks/
│   │   └── useScrollLock.js                # Hook khóa cuộn: dừng lenis + body overflow hidden khi modal/drawer mở, tự phục hồi khi đóng
│   ├── lib/
│   │   └── lenis-instance.js               # Singleton module-level quản lý instance Lenis active (setLenisInstance / getLenisInstance)
│   ├── components/
│   │   ├── Banner.jsx                      # Banner hiển thị tên đơn vị, tiêu đề cuộc thi, badge doanh nghiệp
│   │   ├── ChangePasswordModal.jsx         # Modal đổi mật khẩu bắt buộc lần đầu (mustChangePassword), useScrollLock
│   │   ├── ConfirmDialog.jsx               # Dialog xác nhận bất đồng bộ thay thế window.confirm(), hook useConfirm(), useScrollLock
│   │   ├── ContactSection.jsx              # Section thông tin liên hệ kỹ thuật + thông tin công ty Z176
│   │   ├── CTAButton.jsx                   # Nút gọi hành động chính trên trang chủ (Vào thi, Tra cứu kết quả)
│   │   ├── ErrorBoundary.jsx               # Bọc bắt lỗi render component React, hiển thị fallback UI an toàn
│   │   ├── ExamModal.jsx                   # Modal phòng thi toàn màn hình: câu hỏi, đếm giờ, autosave, heartbeat 15s, tự nộp khi vắng mặt >1p, cảnh báo rời thi, useScrollLock
│   │   ├── Footer.jsx                      # Footer trang chủ: thông tin bản quyền, liên hệ, chính sách
│   │   ├── Header.jsx                      # Header navigation: logo tùy chỉnh, menu điều hướng, user info, đăng xuất, NotificationBell, mobile drawer, useScrollLock
│   │   ├── LoginModal.jsx                  # Modal đăng nhập: form username/password, validation, gọi auth service, useScrollLock
│   │   ├── LogoSelectorModal.jsx           # Modal tùy chỉnh/chọn logo đơn vị hiển thị (dành cho Admin), useScrollLock
│   │   ├── NotificationBell.jsx            # Chuông thông báo: badge đếm chưa đọc (poll định kỳ), dropdown phân loại sự kiện, đọc tất cả
│   │   ├── QuickGuideSection.jsx           # Section hướng dẫn 4 bước thi trắc nghiệm trên trang chủ
│   │   ├── RegulationsSection.jsx          # Section quy chế thi trắc nghiệm chuyên môn Z176
│   │   ├── ResultsLookupSection.jsx        # Section tra cứu kết quả thi công khai theo Mã nhân viên / Họ tên / Phòng ban
│   │   ├── SessionRevokedModal.jsx         # Modal chặn thao tác khi phiên đăng nhập bị thu hồi (đăng nhập từ nơi khác), useScrollLock
│   │   ├── TimeAndCountdown.jsx            # Hiển thị đồng hồ thời gian thực và đếm ngược kỳ thi active
│   │   ├── Toast.jsx                       # Toast notification thông báo kết quả thao tác (success/error/info/warning)
│   │   ├── ToastContext.jsx                # React Context + Provider quản lý hàng đợi Toast toàn app, hook useToast()
│   │   └── UnitLogoDisplay.jsx             # Component hiển thị logo đơn vị (ưu tiên logo custom từ localStorage, fallback logo.svg)
│   │
│   ├── components/admin/
│   │   ├── AccountTab.jsx                  # Tab quản lý tài khoản: CRUD user, tạo inline phòng ban, import Excel 2 bước (preview -> confirm), xuất credentials, phân role, khóa/mở (lockedAt), reset password, useScrollLock
│   │   ├── AuditLogTab.jsx                 # Tab nhật ký hệ thống: phân trang, lọc theo action/user/resource/thời gian, chi tiết metadata
│   │   ├── BackupTab.jsx                   # Tab sao lưu & phục hồi: danh sách backup Google Drive, tạo backup tức thì, tải về, restore file .gz với progress % và phrase xác nhận
│   │   └── OverviewTab.jsx                 # Tab tổng quan admin: thống kê tài khoản theo role, kỳ thi active, số lượng câu hỏi
│   │
│   ├── components/examiner/
│   │   ├── DepartmentTab.jsx               # Tab quản lý phòng ban: CRUD phòng ban, mã code, slug, tìm kiếm, ngừng sử dụng/khôi phục, cơ chế 2 bước cảnh báo/chặn xóa nhầm khi có thí sinh thi hoặc còn nhân viên active, useScrollLock
│   │   ├── ExamProposalTab.jsx             # Tab đề xuất kỳ thi: tạo mới / chỉnh sửa dự thảo (draft/rejected), cấu hình câu hỏi theo độ khó/phạm vi (chung/riêng), thời gian thi, nộp duyệt, useScrollLock
│   │   ├── OverviewTab.jsx                 # Tab tổng quan examiner: thống kê ngân hàng câu hỏi, chủ đề, trạng thái đề xuất
│   │   ├── QuestionBankTab.jsx             # Tab ngân hàng câu hỏi: CRUD câu hỏi đơn/nhiều đáp án, upload ảnh Cloudinary, import Excel 2 bước, xóa hàng loạt, useScrollLock
│   │   ├── StudyDocumentTab.jsx            # Tab tài liệu ôn tập: upload file PDF/Word/Excel lên server nội bộ, phân quyền phòng ban, xem/tải/xóa
│   │   └── TopicTab.jsx                    # Tab chủ đề thi: CRUD chủ đề, tự động khôi phục nếu tạo trùng tên chủ đề đã xóa mềm
│   │
│   ├── components/leader/
│   │   ├── DepartmentReportTab.jsx         # Tab báo cáo phòng ban: thống kê số thí sinh, số lượt thi, tỷ lệ đạt/không đạt theo từng đơn vị
│   │   ├── DetailedResultsTab.jsx          # Tab kết quả chi tiết: danh sách bảng điểm thí sinh, bộ lọc nâng cao, xuất Excel, cấp thêm lượt thi
│   │   ├── ExamReportTab.jsx               # Tab báo cáo kỳ thi: thống kê tổng hợp kết quả theo từng kỳ thi, xuất báo cáo Excel
│   │   ├── ExamReviewTab.jsx               # Tab duyệt đề thi: xem chi tiết cấu hình đề, duyệt (approve), từ chối (reject kèm lý do), phát hành (publish), lưu trữ (archive), useScrollLock
│   │   └── OverviewTab.jsx                 # Tab tổng quan leader: biểu đồ và chỉ số hiệu suất thi toàn đơn vị
│   │
│   ├── pages/
│   │   ├── admin/AdminDashboard.jsx        # Dashboard Quản trị viên: điều phối các tab Admin (Overview, Account, AuditLog, Backup)
│   │   ├── candidate/CandidateDashboard.jsx# Dashboard Thí sinh: xem kỳ thi active, tài liệu ôn tập theo phòng ban, lịch sử làm bài, vào thi
│   │   ├── examiner/ExaminerDashboard.jsx  # Dashboard Người ra đề: điều phối các tab Examiner (Overview, QuestionBank, Topic, Department, ExamProposal, StudyDocument)
│   │   └── leader/LeaderDashboard.jsx      # Dashboard Người duyệt đề: điều phối các tab Leader (Overview, ExamReview, DepartmentReport, ExamReport, DetailedResults)
│   │
│   └── services/
│       ├── api.js                          # HTTP client trung tâm: apiRequest(), gắn Bearer token, silent refresh token với queueing, xử lý 401 & SESSION_EXPIRED_EVENT
│       ├── token-store.js                  # Module lưu trữ accessToken trong localStorage (get, save, clear, getAuthHeaders)
│       ├── auth.service.js                 # Service xác thực: loginUser, refreshAccessToken, logoutUser, fetchMe, changePassword
│       ├── admin.service.js                # Service quản trị: fetchOverviewStats, CRUD user, import/export Excel nhân viên, backup/restore API
│       ├── exam-attempt.service.js         # Service làm bài thi: fetchMyExam, startExamAttempt, submitExamAttempt, answerExamQuestion (autosave), sendExamHeartbeat
│       ├── exam-review.service.js          # Service workflow kỳ thi: fetchPendingExams, fetchApprovedExams, fetchExamHistory, approveExam, rejectExam, publishExam, archiveExam, fetchActiveExam, grantExtraAttempt
│       ├── examiner.service.js             # Service người ra đề: CRUD câu hỏi, upload ảnh câu hỏi, preview/confirm import câu hỏi, xóa hàng loạt, CRUD chủ đề, CRUD phòng ban, tạo/chỉnh sửa đề xuất kỳ thi
│       ├── notification.service.js         # Service thông báo: fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead
│       ├── report.service.js               # Service báo cáo: fetchOverviewStats, fetchResultsByDepartment, fetchResultsByExam, fetchPublicResultsByDepartment, lookupPublicResult, fetchDetailedResults, exportDetailedResultsExcel, exportExamReportExcel, fetchMyResults
│       └── study-document.service.js       # Service tài liệu: fetchStudyDocuments, fetchCandidateDocuments, createStudyDocument, deleteStudyDocument, getStudyDocumentFileBlob
└── dist/                                   # Đầu ra build production (Vite build)
```

## Quản lý Trạng thái (State Management)

Dự án sử dụng chiến lược quản lý trạng thái phân tán, chủ yếu dựa trên React Context và Local State:

- **Auth State**: Quản lý tập trung tại `App.jsx` (lưu trữ `user`, `role`, `mustChangePassword`) truyền xuống các dashboard con và modal. Định kỳ kiểm tra phiên (5s/lần) phát hiện tokenVersion thay đổi do đăng nhập từ nơi khác.
- **Global UI State**:
  - `ToastContext`: Cung cấp hàm `showToast(msg, type)` / `addToast()` để hiển thị thông báo phản hồi thao tác.
  - `ConfirmDialog (ConfirmContext)`: Quản lý hiển thị dialog xác nhận bất đồng bộ qua hook `useConfirm()` thay thế dialog trình duyệt gốc.
- **Scroll Lock**: Module-level singleton (`lib/lenis-instance.js`) kết hợp hook `useScrollLock.js` quản lý trạng thái khóa cuộn khi modal/drawer mở. Gọi `lenis.stop()` + `document.body.style.overflow = 'hidden'` khi `isLocked = true`, phục hồi khi đóng.
- **Local State**: Các bảng dữ liệu, bộ lọc, modal form quản lý trạng thái độc lập bằng `useState`, `useReducer`, `useRef`.

## Tích hợp API và Gọi dữ liệu (API Integration & Data Fetching)

- **HTTP Client (`api.js`)**: Cấu hình URL cơ sở `VITE_API_URL`, hỗ trợ `credentials: 'include'` cho Refresh Token Cookie.
- **Cơ chế Token & Queue Refresh**:
  - Header `Authorization: Bearer <token>` được lấy tự động từ `token-store.js`.
  - Khi gặp lỗi 401 (Unauthorized), hệ thống kích hoạt luồng *Silent Refresh Token* ngầm (`/api/auth/refresh`).
  - Gom nhiều request 401 xảy ra đồng thời vào duy nhất 1 Promise hàng đợi (queueing mechanism), ngăn chặn race condition hay spam refresh request.
- **Sự kiện Phiên làm việc (`SESSION_EXPIRED_EVENT`)**: Khi refresh thất bại hoặc tài khoản bị thu hồi/đăng nhập nơi khác, hệ thống kích hoạt custom event để hiển thị `SessionRevokedModal` và xóa token.

## Routing và Phân quyền Giao diện (Routing & Role-based UI)

- Điều hướng hiển thị điều kiện (conditional rendering) gọn nhẹ dựa trên trạng thái `user.roleCode` tại `App.jsx`:
  - `admin`: Điều phối qua `AdminDashboard` (Tổng quan, Tài khoản, Nhật ký, Sao lưu).
  - `examiner`: Điều phối qua `ExaminerDashboard` (Tổng quan, Ngân hàng câu hỏi, Chủ đề, Phòng ban, Đề xuất kỳ thi, Tài liệu ôn tập).
  - `leader`: Điều phối qua `LeaderDashboard` (Tổng quan, Duyệt đề, Báo cáo phòng ban, Báo cáo kỳ thi, Kết quả chi tiết).
  - `candidate`: Điều phối qua `CandidateDashboard` (Thông tin ca thi, Tài liệu theo phòng ban, Lịch sử thi, Nút vào phòng thi).
  - Khách chưa đăng nhập: Hiển thị Landing Page (Banner, Đồng hồ đếm ngược, Quy chế, Hướng dẫn, Tra cứu công khai).
- Chặn truy cập nghiệp vụ nếu tài khoản có cờ `mustChangePassword = true`, mở bắt buộc `ChangePasswordModal`.

## Tiêu chuẩn UI/CSS (Tailwind v4)

- **Cấu hình**: Sử dụng Tailwind CSS v4 với plugin `@tailwindcss/vite`, định nghĩa tokens CSS qua `@theme` trong `index.css`.
- **Responsive**: Thiết kế tối ưu Mobile & Desktop, hỗ trợ Drawer trượt cho thiết bị di động.
- **Hiệu ứng & Smooth Scroll**:
  - Tích hợp `Lenis` tạo hiệu ứng cuộn mượt toàn trang chủ.
  - Sử dụng `Motion` (Framer Motion) và class Tailwind cho animations, transitions và feedback người dùng.
- **Icons**: Đồng bộ hệ thống icon từ thư viện `lucide-react`.
