# Cấu trúc client

## Phạm vi và trạng thái

`client/` là ứng dụng giao diện một trang, sử dụng React 19, Vite và Tailwind CSS. Hiện có landing page, modal đăng nhập/vào thi, tra cứu kết quả và phần hiển thị logo; dữ liệu nghiệp vụ trong giao diện vẫn là dữ liệu mẫu cho đến khi backend được tích hợp hoàn chỉnh.

- Không liệt kê `node_modules/` vì là dependency cài đặt.
- `dist/` là đầu ra build, không chỉnh sửa trực tiếp.
- Không đưa dữ liệu thật của Z176 vào mã nguồn hoặc workflow AI.

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
│   ├── images/
│   │   └── HeroSection.jpg
│   └── logo/
│       └── logo.svg
├── src/
│   ├── App.jsx
│   ├── data.js
│   ├── index.css
│   ├── main.jsx
│   ├── mock-data/
│   │   └── admin.mock.js
│   ├── assets/images/
│   │   └── military_banner_bg_1786353296945.jpg
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AccountTab.jsx
│   │   │   ├── AuditLogTab.jsx
│   │   │   └── OverviewTab.jsx
│   │   ├── Banner.jsx
│   │   ├── CTAButton.jsx
│   │   ├── ContactSection.jsx
│   │   ├── ExamModal.jsx
│   │   ├── Footer.jsx
│   │   ├── Header.jsx
│   │   ├── LoginModal.jsx
│   │   ├── LogoSelectorModal.jsx
│   │   ├── QuickGuideSection.jsx
│   │   ├── RegulationsSection.jsx
│   │   ├── ResultsLookupSection.jsx
│   │   ├── TimeAndCountdown.jsx
│   │   ├── UnitLogoDisplay.jsx
│   │   └── examiner/
│   │   │   ├── DepartmentTab.jsx
│   │   │   ├── QuestionBankTab.jsx
│   │   │   └── TopicTab.jsx
│   ├── pages/admin/
│   │   └── AdminDashboard.jsx
│   ├── pages/examiner/
│   │   └── ExaminerDashboard.jsx
│   └── services/
│       ├── admin.service.js
│       ├── api.js
│       ├── auth.service.js
│       └── examiner.service.js
└── dist/                         # đầu ra sau npm run build
```

## Tệp và thư mục chính

| Đường dẫn | Chức năng |
|---|---|
| `src/main.jsx` | Điểm khởi động React; render `App` và nạp CSS dùng chung. |
| `src/App.jsx` | Điều phối navigation, trạng thái xác thực, modal và logo đơn vị. Tạo cụm hero gồm banner, thời gian thi và CTA; điều hướng theo role đến dashboard quản trị hoặc dashboard người ra đề. |
| `src/index.css` | Nạp Tailwind, đặt nền/chữ mặc định và các utility nội bộ. |
| `src/data.js` | Cấu hình nội dung hiển thị và dữ liệu mẫu của giao diện. |
| `src/services/api.js` | Đọc `VITE_API_URL`, thực hiện request JSON và chuẩn hóa phản hồi API. |
| `src/services/auth.service.js` | Helper đăng nhập, refresh token, lấy hồ sơ, đăng xuất và quản lý access token phía client. |
| `src/services/admin.service.js` | Lớp gọi API quản trị tài khoản/role; phần số liệu tổng quan, audit log và backup hiện còn dùng phản hồi mock. |
| `src/services/examiner.service.js` | Lớp gọi API có Bearer token cho câu hỏi, chủ đề, phòng ban và import Excel. |
| `src/mock-data/admin.mock.js` | Dữ liệu mock dành riêng cho giao diện dashboard quản trị. |
| `public/images/HeroSection.jpg` | Ảnh nền cho toàn bộ cụm hero trên trang chủ. |
| `public/logo/logo.svg` | Logo doanh nghiệp mặc định; `UnitLogoDisplay` dùng file này cho cấu hình logo mặc định. |
| `src/assets/images/military_banner_bg_1786353296945.jpg` | Tài nguyên ảnh cũ trong source; không phải ảnh hero đang sử dụng. |
| `src/pages/admin/AdminDashboard.jsx` | Trang dashboard cho quản trị viên đã xác thực. |
| `src/pages/examiner/ExaminerDashboard.jsx` | Trang dashboard cho người ra đề, gồm các tab ngân hàng câu hỏi, chủ đề và phòng ban. |

## Thành phần giao diện

| Component | Vai trò |
|---|---|
| `Header.jsx` | Thanh điều hướng cố định, menu desktop/mobile và nút đăng nhập. |
| `Banner.jsx` | Nhãn đơn vị, tiêu đề và thông tin cuộc thi trong hero. |
| `TimeAndCountdown.jsx` | Thời gian diễn ra và bộ đếm ngược. |
| `CTAButton.jsx` | Nút hành động chính để mở luồng vào thi. |
| `RegulationsSection.jsx` | Quy chế, cấu trúc bài thi và hướng dẫn trước khi thi. |
| `QuickGuideSection.jsx` | Hướng dẫn thao tác nhanh. |
| `ResultsLookupSection.jsx` | Giao diện tra cứu kết quả theo dữ liệu mẫu. |
| `ContactSection.jsx` và `Footer.jsx` | Thông tin liên hệ và chân trang. |
| `LoginModal.jsx`, `ExamModal.jsx` | Modal đăng nhập và luồng thi phía client. |
| `LogoSelectorModal.jsx`, `UnitLogoDisplay.jsx` | Chọn/hiển thị logo đơn vị. |
| `components/admin/` | Các tab tài khoản, nhật ký audit và tổng quan trong dashboard quản trị. |
| `components/examiner/` | Các tab quản lý câu hỏi, chủ đề và phòng ban của dashboard người ra đề. |

## Luồng giao diện và tài nguyên

1. `index.html` tải `src/main.jsx`, sau đó render `App.jsx`.
2. `App.jsx` hiển thị hero dùng `/images/HeroSection.jpg`, căn ảnh ở tâm thấp hơn và phủ vignette để giữ độ tương phản chữ.
3. Logo mặc định được `UnitLogoDisplay` tải từ `/logo/logo.svg`; cấu hình logo tùy chọn của người dùng được lưu ở `localStorage` với khóa `z176_unit_logo_v2`.
4. Các lời gọi API đi qua `services/api.js`; helper xác thực nằm tại `services/auth.service.js`. Sau đăng nhập, `App.jsx` điều hướng `admin` hoặc `examiner` đến dashboard tương ứng.
5. Dashboard người ra đề gọi API qua `services/examiner.service.js` để quản lý ngân hàng câu hỏi, chủ đề và phòng ban.
