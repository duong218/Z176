# Cấu trúc client

## Phạm vi

`client/` là ứng dụng React 19 + Vite + Tailwind CSS v4. Sử dụng Lenis cho smooth scroll, Lucide React cho icon, Motion cho animation, Recharts cho biểu đồ. `dist/` là đầu ra build; không chỉnh sửa trực tiếp. Dữ liệu mock chỉ phục vụ phát triển, không dùng dữ liệu thật của Z176 trong workflow AI.

```text
client/
├── .gitignore                              # Loại trừ node_modules, dist, .env khỏi git
├── eslint.config.js                        # Cấu hình ESLint cho React/JSX
├── index.html                              # Entry HTML, mount #root, favicon dùng logo.svg
├── metadata.json                           # Metadata dự án (tên, mô tả, capabilities)
├── package.json                            # Dependencies & scripts (dev, build, lint)
├── package-lock.json                       # Lockfile npm
├── vite.config.js                          # Cấu hình Vite: plugin React + Tailwind, alias @
├── assets/                                 # Thư mục tĩnh cấp root (hiện trống)
├── public/
│   ├── images/
│   │   └── HeroSection.jpg                 # Ảnh nền hero section trang chủ
│   ├── logo/
│   │   └── logo.svg                        # Logo doanh nghiệp mặc định / favicon
│   └── templates/
│       ├── Mau_Import_Cau_Hoi_Z176.xlsx    # Mẫu Excel import câu hỏi ngân hàng đề
│       └── Mau_Import_Nhan_Vien_Z176.xlsx  # Mẫu Excel import danh sách nhân viên
├── src/
│   ├── App.jsx                             # Component gốc: AppShell (ToastProvider + ConfirmProvider) → App
│   ├── data.js                             # Dữ liệu tĩnh Z176: thông tin công ty, phòng ban, quy chế thi, hướng dẫn
│   ├── index.css                           # CSS gốc, import Tailwind CSS v4
│   ├── main.jsx                            # Entry point React: render AppShell bọc trong StrictMode + ErrorBoundary
│   ├── assets/
│   │   └── images/
│   │       └── military_banner_bg_*.jpg    # Ảnh nền banner quân đội
│   ├── mock-data/
│   │   └── admin.mock.js                   # Dữ liệu mock cho dashboard quản trị (dev only)
│   ├── components/
│   │   ├── Banner.jsx                      # Banner hiển thị tên đơn vị, tiêu đề cuộc thi, badge
│   │   ├── ChangePasswordModal.jsx         # Modal đổi mật khẩu (bắt buộc lần đầu đăng nhập)
│   │   ├── ConfirmDialog.jsx               # Dialog xác nhận thay thế window.confirm(), dùng Context API
│   │   ├── ContactSection.jsx              # Section thông tin liên hệ hỗ trợ + thông tin công ty
│   │   ├── CTAButton.jsx                   # Nút gọi hành động chính (CTA) trên trang chủ
│   │   ├── ErrorBoundary.jsx               # Bao lỗi render React, tránh crash toàn bộ giao diện
│   │   ├── ExamModal.jsx                   # Modal làm bài thi: hiển thị câu hỏi, đếm giờ, autosave, heartbeat, nộp bài
│   │   ├── Footer.jsx                      # Footer trang với thông tin bản quyền, liên kết
│   │   ├── Header.jsx                      # Header navigation: logo, menu, trạng thái đăng nhập, chuông thông báo
│   │   ├── LoginModal.jsx                  # Modal đăng nhập: form username/password, gọi auth API
│   │   ├── LogoSelectorModal.jsx           # Modal chọn/tùy chỉnh logo đơn vị (admin)
│   │   ├── NotificationBell.jsx            # Chuông thông báo: badge đếm chưa đọc, dropdown danh sách, đánh dấu đã đọc
│   │   ├── QuickGuideSection.jsx           # Section hướng dẫn nhanh cách thi trên trang chủ
│   │   ├── RegulationsSection.jsx          # Section quy chế thi trắc nghiệm trên trang chủ
│   │   ├── ResultsLookupSection.jsx        # Section tra cứu kết quả thi công khai trên trang chủ
│   │   ├── SessionRevokedModal.jsx         # Modal chặn thao tác khi phiên bị thu hồi (đăng nhập nơi khác)
│   │   ├── TimeAndCountdown.jsx            # Hiển thị giờ hiện tại & đếm ngược đến kỳ thi
│   │   ├── Toast.jsx                       # Component toast notification (success/error/info)
│   │   ├── ToastContext.jsx                # Context + Provider quản lý toast toàn app
│   │   └── UnitLogoDisplay.jsx             # Hiển thị logo đơn vị tùy chỉnh hoặc logo mặc định
│   │
│   │   ├── admin/
│   │   │   ├── AccountTab.jsx              # Tab quản lý tài khoản: CRUD user, tạo nhanh phòng ban inline từ dropdown, import/export Excel, phân role, khóa/mở, reset mật khẩu
│   │   │   ├── AuditLogTab.jsx             # Tab nhật ký hệ thống: lọc theo hành động/người dùng/thời gian, phân trang, xem chi tiết audit log (hỗ trợ đầy đủ nhãn hành động Backup, Câu hỏi, Chủ đề, Tài liệu, Phòng ban)
│   │   │   ├── BackupTab.jsx               # Tab quản lý sao lưu: danh sách file backup trên Drive, tải về, khôi phục an toàn
│   │   │   └── OverviewTab.jsx             # Tab tổng quan admin: thống kê user, kỳ thi, câu hỏi
│   │   │
│   │   ├── examiner/
│   │   │   ├── DepartmentTab.jsx           # Tab quản lý phòng ban: CRUD phòng ban, mã phòng ban
│   │   │   ├── ExamProposalTab.jsx         # Tab đề xuất kỳ thi: tạo, chỉnh sửa, đệ trình đề thi
│   │   │   ├── OverviewTab.jsx             # Tab tổng quan examiner: thống kê câu hỏi, chủ đề, đề xuất
│   │   │   ├── QuestionBankTab.jsx         # Tab ngân hàng câu hỏi: CRUD câu hỏi, import Excel, lọc theo chủ đề/phòng ban/độ khó (dùng searchRef tối ưu tìm kiếm), xóa hàng loạt
│   │   │   ├── StudyDocumentTab.jsx        # Tab quản lý tài liệu ôn tập: upload/xóa file (hỗ trợ ConfirmDialog), phân quyền phòng ban
│   │   │   └── TopicTab.jsx                # Tab quản lý chủ đề: CRUD chủ đề thi
│   │   │
│   │   └── leader/
│   │       ├── DepartmentReportTab.jsx     # Tab báo cáo theo phòng ban: thống kê tỉ lệ đạt/không đạt
│   │       ├── DetailedResultsTab.jsx      # Tab kết quả chi tiết: danh sách thí sinh, điểm, xuất Excel, cấp thêm lượt thi
│   │       ├── ExamReportTab.jsx           # Tab báo cáo theo kỳ thi: thống kê kết quả từng kỳ thi
│   │       ├── ExamReviewTab.jsx           # Tab duyệt đề: xem, duyệt, từ chối, phát hành, lưu trữ đề thi
│   │       └── OverviewTab.jsx             # Tab tổng quan leader: thống kê toàn hệ thống
│   │
│   ├── pages/
│   │   ├── admin/
│   │   │   └── AdminDashboard.jsx          # Dashboard quản trị: điều phối các tab admin (Overview, Account, AuditLog)
│   │   ├── candidate/
│   │   │   └── CandidateDashboard.jsx      # Dashboard thí sinh: xem kỳ thi, tài liệu ôn tập, vào thi, xem kết quả
│   │   ├── examiner/
│   │   │   └── ExaminerDashboard.jsx       # Dashboard người ra đề: điều phối các tab examiner
│   │   └── leader/
│   │       └── LeaderDashboard.jsx         # Dashboard người duyệt đề: điều phối các tab leader
│   │
│   └── services/
│       ├── api.js                          # HTTP client chung: apiRequest() với auto refresh token, xử lý 401, SESSION_EXPIRED_EVENT
│       ├── token-store.js                  # Quản lý access token trong localStorage (get/save/clear/getAuthHeaders)
│       ├── auth.service.js                 # API xác thực: login, refresh, logout, fetchMe, changePassword
│       ├── admin.service.js                # API quản trị: CRUD user, import/export Excel nhân viên, phân role, khóa/mở, reset password
│       ├── exam-attempt.service.js         # API lượt thi thí sinh: fetchMyExam, start, submit, autosave câu trả lời, heartbeat
│       ├── exam-review.service.js          # API quản lý kỳ thi: danh sách, duyệt, từ chối, phát hành, lưu trữ, lấy kỳ thi active
│       ├── examiner.service.js             # API người ra đề: CRUD câu hỏi, chủ đề, phòng ban, import Excel câu hỏi
│       ├── notification.service.js         # API thông báo: lấy danh sách, đếm chưa đọc, đánh dấu đã đọc
│       ├── report.service.js               # API báo cáo: tổng quan, theo phòng ban, theo kỳ thi, kết quả chi tiết, xuất Excel
│       └── study-document.service.js       # API tài liệu ôn tập: CRUD, xem/tải file (Blob + Authorization header)
└── dist/                                   # Đầu ra build production (không chỉnh sửa trực tiếp)
```

## Thành phần chính

| Đường dẫn | Chức năng |
|---|---|
| `index.html` | Trang HTML gốc, mount `#root`, favicon dùng `/logo/logo.svg`. |
| `vite.config.js` | Cấu hình Vite: plugin React + Tailwind CSS v4, alias `@` trỏ về thư mục client root. |
| `metadata.json` | Metadata dự án: tên hệ thống, mô tả, capabilities. |
| `src/main.jsx` | Entry point: render `AppShell` bọc trong `StrictMode` + `ErrorBoundary`. |
| `src/App.jsx` | Component gốc: `AppShell` cung cấp `ToastProvider` + `ConfirmProvider`; `App` bên trong điều phối trang chủ / dashboard theo role, quản lý auth state, poll kỳ thi active, kiểm tra phiên bị thu hồi. |
| `src/data.js` | Dữ liệu tĩnh: thông tin công ty Z176, danh sách phòng ban, quy chế thi, hướng dẫn nhanh. |
| `src/index.css` | CSS gốc, import Tailwind CSS v4. |

### Components — Dùng chung

| Component | Chức năng |
|---|---|
| `Banner.jsx` | Banner hiển thị tên đơn vị, tiêu đề cuộc thi, badge doanh nghiệp. |
| `ChangePasswordModal.jsx` | Modal đổi mật khẩu, bắt buộc lần đầu đăng nhập. |
| `ConfirmDialog.jsx` | Dialog xác nhận thay thế `window.confirm()`, dùng chung qua Context API. |
| `ContactSection.jsx` | Section thông tin liên hệ hỗ trợ kỹ thuật + thông tin công ty. |
| `CTAButton.jsx` | Nút gọi hành động chính (CTA) trên trang chủ — vào thi, tra cứu kết quả. |
| `ErrorBoundary.jsx` | Bao lỗi render React, hiển thị fallback UI thay vì crash toàn bộ. |
| `ExamModal.jsx` | Modal làm bài thi toàn màn hình: hiển thị câu hỏi trắc nghiệm, đếm giờ ngược, autosave mỗi khi chọn đáp án, heartbeat định kỳ 15s, tự nộp bài khi rời ca thi quá 1 phút. |
| `Footer.jsx` | Footer với thông tin bản quyền, liên kết. |
| `Header.jsx` | Header navigation: logo tuỳ chỉnh, menu điều hướng, trạng thái đăng nhập, chuông thông báo. |
| `LoginModal.jsx` | Modal đăng nhập: form username/password, gọi API login. |
| `LogoSelectorModal.jsx` | Modal cho admin chọn/tùy chỉnh logo đơn vị hiển thị trên trang. |
| `NotificationBell.jsx` | Chuông thông báo trên header: badge đếm tin chưa đọc, dropdown danh sách, đánh dấu đã đọc/đọc tất cả. |
| `QuickGuideSection.jsx` | Section hướng dẫn nhanh cách tham gia thi. |
| `RegulationsSection.jsx` | Section quy chế thi trắc nghiệm chuyên môn. |
| `ResultsLookupSection.jsx` | Section tra cứu kết quả thi công khai (không cần đăng nhập). |
| `SessionRevokedModal.jsx` | Modal chặn thao tác khi phiên bị thu hồi (tài khoản đăng nhập nơi khác). |
| `TimeAndCountdown.jsx` | Hiển thị giờ hiện tại và đếm ngược đến kỳ thi sắp diễn ra. |
| `Toast.jsx` | Component toast notification (success/error/info/warning). |
| `ToastContext.jsx` | Context + Provider quản lý hàng đợi toast toàn app, hook `useToast()`. |
| `UnitLogoDisplay.jsx` | Hiển thị logo đơn vị tùy chỉnh hoặc fallback về logo mặc định. |

### Components — Admin

| Component | Chức năng |
|---|---|
| `admin/AccountTab.jsx` | Tab quản lý tài khoản: tạo tài khoản đơn lẻ, tạo nhanh phòng ban inline từ modal con trong dropdown phòng ban (dùng lại `createDepartment()` từ `examiner.service`), import danh sách nhân viên từ Excel (preview → confirm 2 bước), xuất danh sách tài khoản + mật khẩu tạm ra Excel, phân role, khóa/mở khóa, reset mật khẩu. |
| `admin/AuditLogTab.jsx` | Tab nhật ký hệ thống: lọc theo hành động/người dùng/thời gian/loại tài nguyên (User, Exam, Question, Topic, Department, Backup), phân trang, xem chi tiết metadata; hiển thị đầy đủ nhãn hành động tiếng Việt chuẩn hóa. |
| `admin/BackupTab.jsx` | Tab quản lý sao lưu & khôi phục: tải file từ Google Drive, ghi đè/khôi phục lại CSDL với tính năng % tiến trình (progress) và chặn thao tác an toàn. |
| `admin/OverviewTab.jsx` | Tab tổng quan: thống kê nhanh số user, kỳ thi, câu hỏi trong hệ thống. |

### Components — Examiner (Người ra đề)

| Component | Chức năng |
|---|---|
| `examiner/DepartmentTab.jsx` | Tab quản lý phòng ban: CRUD phòng ban, mã phòng ban. |
| `examiner/ExamProposalTab.jsx` | Tab đề xuất kỳ thi: tạo đề thi mới (chọn chủ đề, cấu hình số câu, thời gian), chỉnh sửa, đệ trình lên Leader duyệt. |
| `examiner/OverviewTab.jsx` | Tab tổng quan: thống kê câu hỏi, chủ đề, trạng thái đề xuất. |
| `examiner/QuestionBankTab.jsx` | Tab ngân hàng câu hỏi: CRUD câu hỏi trắc nghiệm (đơn/nhiều đáp án), upload ảnh minh hoạ, import hàng loạt từ Excel, lọc theo chủ đề/phòng ban/độ khó/phạm vi, xóa hàng loạt (tối ưu hóa `useRef` + `useCallback` tránh re-render thừa khi gõ tìm kiếm). |
| `examiner/StudyDocumentTab.jsx` | Tab quản lý tài liệu ôn tập: upload file (PDF/Word/Excel), gắn chủ đề, phạm vi chung/riêng phòng ban, xem/tải/xóa (sử dụng `ConfirmDialog` cho xác nhận gỡ tài liệu). |
| `examiner/TopicTab.jsx` | Tab quản lý chủ đề: CRUD chủ đề thi. |

### Components — Leader (Người duyệt đề)

| Component | Chức năng |
|---|---|
| `leader/DepartmentReportTab.jsx` | Tab báo cáo theo phòng ban: tỉ lệ đạt/không đạt từng phòng ban. |
| `leader/DetailedResultsTab.jsx` | Tab kết quả chi tiết: danh sách thí sinh kèm điểm, xuất Excel, cấp thêm lượt thi chính thức. |
| `leader/ExamReportTab.jsx` | Tab báo cáo theo kỳ thi: thống kê kết quả từng kỳ thi đã diễn ra, xuất Excel. |
| `leader/ExamReviewTab.jsx` | Tab duyệt đề: xem chi tiết đề xuất, duyệt/từ chối/phát hành chính thức/lưu trữ kỳ thi. |
| `leader/OverviewTab.jsx` | Tab tổng quan: thống kê toàn hệ thống cho Leader. |

### Pages (Dashboard)

| Page | Chức năng |
|---|---|
| `pages/admin/AdminDashboard.jsx` | Dashboard quản trị viên: điều phối 4 tab (Overview, Account, AuditLog, Backup). |
| `pages/candidate/CandidateDashboard.jsx` | Dashboard thí sinh: xem kỳ thi đang diễn ra, tài liệu ôn tập, vào phòng thi, xem lịch sử kết quả. |
| `pages/examiner/ExaminerDashboard.jsx` | Dashboard người ra đề: điều phối các tab (Overview, QuestionBank, Topic, Department, ExamProposal, StudyDocument). |
| `pages/leader/LeaderDashboard.jsx` | Dashboard người duyệt đề: điều phối các tab (Overview, ExamReview, DepartmentReport, ExamReport, DetailedResults). |

### Services

| Service | Chức năng |
|---|---|
| `services/api.js` | HTTP client chung: `apiRequest()` tự động gắn Authorization header, xử lý 401 bằng silent refresh (gom nhiều request cùng lúc thành 1 lần refresh duy nhất), phát `SESSION_EXPIRED_EVENT` khi refresh thất bại. |
| `services/token-store.js` | Quản lý access token trong `localStorage`: `getAccessToken()`, `saveAccessToken()`, `clearAccessToken()`, `getAuthHeaders()`. |
| `services/auth.service.js` | API xác thực: `loginUser()`, `refreshAccessToken()`, `logoutUser()`, `fetchMe()`, `changePassword()`. |
| `services/admin.service.js` | API quản trị: CRUD user, import Excel nhân viên, phân role, khóa/mở, reset mật khẩu, chức năng sao lưu/khôi phục (`fetchBackups`, `restoreBackupFile` dùng `XMLHttpRequest` bắt sự kiện onprogress). |
| `services/exam-attempt.service.js` | API lượt thi thí sinh: `fetchMyExam()` (lấy đề thi + trạng thái), `startExamAttempt()` (bắt đầu/resume), `submitExamAttempt()` (nộp bài), `answerExamQuestion()` (autosave đáp án), `sendExamHeartbeat()` (heartbeat giữ phiên). |
| `services/exam-review.service.js` | API quản lý kỳ thi: lấy danh sách, duyệt, từ chối, phát hành chính thức, lưu trữ, lấy kỳ thi active cho trang chủ. |
| `services/examiner.service.js` | API người ra đề: CRUD câu hỏi, chủ đề, phòng ban, import Excel câu hỏi. |
| `services/notification.service.js` | API thông báo: `fetchNotifications()`, `fetchUnreadCount()`, `markNotificationRead()`, `markAllNotificationsRead()`. |
| `services/report.service.js` | API báo cáo: tổng quan, theo phòng ban, theo kỳ thi, kết quả chi tiết, xuất Excel, tra cứu kết quả công khai, lịch sử kết quả thí sinh. |
| `services/study-document.service.js` | API tài liệu ôn tập: CRUD tài liệu, xem danh sách (admin/examiner vs candidate), preview file trong tab mới (Blob URL), tải file về máy. |

### Tài nguyên tĩnh

| Đường dẫn | Chức năng |
|---|---|
| `public/images/HeroSection.jpg` | Ảnh nền hero section trang chủ. |
| `public/logo/logo.svg` | Logo doanh nghiệp mặc định, dùng làm favicon. |
| `public/templates/Mau_Import_Cau_Hoi_Z176.xlsx` | Mẫu Excel chuẩn để import câu hỏi vào ngân hàng đề. |
| `public/templates/Mau_Import_Nhan_Vien_Z176.xlsx` | Mẫu Excel chuẩn để import danh sách nhân viên/tài khoản. |
| `src/assets/images/military_banner_bg_*.jpg` | Ảnh nền banner phong cách quân đội. |
| `src/mock-data/admin.mock.js` | Dữ liệu mock phục vụ dashboard quản trị (chỉ dùng khi dev). |

## Luồng chính

1. `main.jsx` render `AppShell` bọc trong `StrictMode` + `ErrorBoundary`.
2. `AppShell` cung cấp `ToastProvider` + `ConfirmProvider` cho toàn app.
3. `App` kiểm tra access token → nếu còn hợp lệ thì auto-login (gọi `fetchMe()`), chuyển sang dashboard tương ứng role.
4. Trang chủ hiển thị Hero (banner + kỳ thi active), quy chế thi, hướng dẫn, tra cứu kết quả, liên hệ.
5. Đăng nhập qua `LoginModal` → nhận access token (lưu `localStorage`) + refresh token (httpOnly cookie).
6. Sau đăng nhập, nếu `mustChangePassword` thì mở `ChangePasswordModal` bắt buộc.
7. Dashboard theo role: `admin` / `examiner` / `leader` / `candidate`.
8. Các service gọi backend qua `api.js`; khi token hết hạn, auto refresh (1 lần duy nhất cho nhiều request đồng thời); khi refresh cũng thất bại, phát `SESSION_EXPIRED_EVENT` → hiện `SessionRevokedModal`.
9. Kiểm tra phiên bị thu hồi mỗi 5s (tài khoản đăng nhập nơi khác → `tokenVersion` thay đổi).
10. Kỳ thi active trên trang chủ tự cập nhật mỗi 60s.

---

## Quản lý Trạng thái (State Management)

Dự án sử dụng chiến lược quản lý trạng thái phân tán, chủ yếu dựa trên React Context và Local State:

- **Auth State**: Quản lý tập trung tại `App.jsx` (lưu trữ `user`, `role`, `mustChangePassword`) truyền xuống các component con dưới dạng props hoặc qua các component bọc (Wrapper).
- **Global UI State**: Sử dụng Context API.
  - `ToastContext`: Cung cấp hàm `addToast()` để hiển thị thông báo ở mọi nơi mà không cần truyền props.
  - `ConfirmContext`: Quản lý hiển thị dialog xác nhận.
- **Local State**: Các form, danh sách, modal quản lý trạng thái độc lập bằng `useState`, `useReducer`.

## Tích hợp API và Gọi dữ liệu (API Integration & Data Fetching)

- **Axios Instance (`api.js`)**: Cấu hình URL cơ sở, timeout và credentials.
- **Interceptor Flow**:
  - Request Interceptor: Tự động gắn header `Authorization: Bearer <token>` bằng token lấy từ `token-store.js`.
  - Response Interceptor: Bắt lỗi 401 (Unauthorized). Gọi luồng *Silent Refresh Token* ngầm để cấp lại access token.
  - **Queueing Mechanism**: Khi refresh đang chạy, mọi request gọi API khác sẽ bị tạm giữ (push vào queue) và chỉ được thực thi tiếp khi refresh thành công (tránh gọi refresh nhiều lần liên tiếp).
- **Custom Event `SESSION_EXPIRED_EVENT`**: Khi refresh thất bại hoặc tokenVersion bị thu hồi, hệ thống phát event để đẩy user ra ngoài (hiển thị modal thông báo và xóa token).

## Routing và Phân quyền Giao diện (Routing & Role-based UI)

- Không sử dụng thư viện Routing phức tạp bên thứ 3 (như react-router) ở quy mô hiện tại mà dùng luồng điều hướng (conditional rendering) thủ công gọn nhẹ qua trạng thái Auth.
- **Tầng bảo vệ (Guards)**: `App.jsx` quyết định load trang chủ hay dashboard dựa vào role của `user` trả về từ `/api/auth/me`.
- Dashboard của từng vai trò được tải theo lazy-load (tuỳ chọn) hoặc nạp động dựa vào role code (`admin`, `examiner`, `leader`, `candidate`).
- Nếu user truy cập trái phép tab của người khác, UI mặc định sẽ không render component tab đó (kiểm duyệt hiển thị 1 chiều từ Frontend).

## Tiêu chuẩn UI/CSS (Tailwind v4)

- **Cấu hình**: Sử dụng Tailwind CSS v4 không cần cấu hình phức tạp trong `tailwind.config.js`, sử dụng cú pháp import CSS nội tuyến `@theme`.
- **Thiết kế Responsive**: Mobile-first cho toàn bộ layout. Tab/Dashboard sử dụng Flexbox/CSS Grid.
- **Animations**:
  - Sử dụng thư viện `Motion` (Framer Motion) hoặc Tailwind classes (`animate-spin`, `transition-all`) cho vi tương tác (micro-interactions).
  - Tối ưu cuộn trang: Sử dụng thư viện `Lenis` tạo hiệu ứng cuộn mượt (Smooth Scrolling) trên trang chủ.
- **Icons**: Sử dụng bộ `Lucide-React`, đồng nhất SVG format cho toàn bộ hệ thống (dễ dàng thay đổi kích thước `size` và màu sắc `strokeWidth`).
