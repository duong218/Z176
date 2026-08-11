# Cấu trúc client

## Phạm vi

`client/` là ứng dụng React 19 + Vite + Tailwind CSS. `dist/` là đầu ra build; không chỉnh sửa trực tiếp. Dữ liệu mock chỉ phục vụ phát triển, không dùng dữ liệu thật của Z176 trong workflow AI.

```text
client/
├── .env.example
├── eslint.config.js
├── index.html
├── metadata.json
├── package.json
├── package-lock.json
├── vite.config.js
├── public/
│   ├── images/HeroSection.jpg
│   └── logo/logo.svg
├── src/
│   ├── App.jsx
│   ├── data.js
│   ├── index.css
│   ├── main.jsx
│   ├── assets/images/military_banner_bg_1786353296945.jpg
│   ├── mock-data/admin.mock.js
│   ├── components/
│   │   ├── admin/{AccountTab,AuditLogTab,OverviewTab}.jsx
│   │   ├── examiner/{DepartmentTab,ExamProposalTab,QuestionBankTab,TopicTab}.jsx
│   │   ├── leader/{DepartmentReportTab,DetailedResultsTab,ExamReviewTab,OverviewTab}.jsx
│   │   ├── Banner.jsx
│   │   ├── ChangePasswordModal.jsx
│   │   ├── ContactSection.jsx
│   │   ├── CTAButton.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── ExamModal.jsx
│   │   ├── Footer.jsx
│   │   ├── Header.jsx
│   │   ├── LoginModal.jsx
│   │   ├── LogoSelectorModal.jsx
│   │   ├── QuickGuideSection.jsx
│   │   ├── RegulationsSection.jsx
│   │   ├── ResultsLookupSection.jsx
│   │   ├── TimeAndCountdown.jsx
│   │   └── UnitLogoDisplay.jsx
│   ├── pages/
│   │   ├── admin/AdminDashboard.jsx
│   │   ├── examiner/ExaminerDashboard.jsx
│   │   └── leader/LeaderDashboard.jsx
│   └── services/
│       ├── admin.service.js
│       ├── api.js
│       ├── auth.service.js
│       ├── examiner.service.js
│       ├── exam-review.service.js
│       └── report.service.js
└── dist/
```

## Thành phần chính

| Đường dẫn | Chức năng |
|---|---|
| `src/main.jsx` | Khởi động React và render `App`. |
| `src/App.jsx` | Điều phối navigation, trạng thái xác thực, modal, hero và dashboard theo role. |
| `src/components/` | Các section trang chủ, modal và thành phần dùng chung. |
| `src/components/admin/` | Tab tổng quan, tài khoản và audit log cho quản trị viên. |
| `src/components/examiner/` | Tab ngân hàng câu hỏi, chủ đề, phòng ban và đề xuất kỳ thi cho người ra đề. |
| `src/components/leader/` | Tab báo cáo, duyệt/phát hành đề xuất kỳ thi và lịch sử xử lý kỳ thi cho Người duyệt đề. |
| `src/pages/` | Ba dashboard riêng cho `admin`, `examiner` và `leader`. |
| `src/services/api.js` | Wrapper gọi API theo `VITE_API_URL`. |
| `src/services/auth.service.js` | Đăng nhập, refresh token, lấy hồ sơ và đăng xuất. |
| `src/services/admin.service.js` | API quản trị tài khoản/role; một số phần dashboard vẫn dùng mock. |
| `src/services/examiner.service.js` | API câu hỏi, chủ đề, phòng ban và import Excel. |
| `src/services/exam-review.service.js` | API lọc danh sách kỳ thi theo trạng thái, duyệt, từ chối, phát hành, lịch sử xử lý và truy vấn kỳ thi đang hoạt động. |
| `src/services/report.service.js` | API báo cáo tổng quan, theo phòng ban, kết quả chi tiết và xuất Excel. |
| `src/components/ErrorBoundary.jsx` | Bao lỗi render phía React để tránh làm hỏng toàn bộ giao diện. |
| `src/components/ChangePasswordModal.jsx` | Modal đổi mật khẩu trong luồng xác thực. |
| `src/mock-data/admin.mock.js` | Dữ liệu mock phục vụ dashboard quản trị. |
| `public/images/HeroSection.jpg` | Ảnh nền hero. |
| `public/logo/logo.svg` | Logo doanh nghiệp mặc định. |

## Luồng chính

1. `main.jsx` render `App.jsx`.
2. `App.jsx` hiển thị trang chủ hoặc dashboard tương ứng với role sau đăng nhập.
3. Các service gọi backend qua `api.js`; route và quyền truy cập được server quyết định.
4. Hero dùng `/images/HeroSection.jpg`; logo mặc định là `/logo/logo.svg`.
