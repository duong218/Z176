# Cấu trúc client

## Phạm vi tài liệu

- Cập nhật theo trạng thái repository hiện tại.
- Không liệt kê `client/node_modules/` vì là thư viện được cài đặt.
- Không phân tích dữ liệu trong `mock-data/`; xem `server.md` để biết phạm vi backend và dữ liệu mock bị bỏ qua.
- `client/dist/` là đầu ra build, không phải mã nguồn chỉnh sửa trực tiếp.

## Tổng quan

`client/` là ứng dụng giao diện một trang dùng React 19, Vite và Tailwind CSS. Ứng dụng hiện triển khai trang chủ cho hệ thống thi nội bộ Z176, các luồng giao diện đăng nhập, vào thi, tra cứu kết quả và thay đổi logo. Chưa có kết nối nghiệp vụ đến backend thực tế; các phần dữ liệu/luồng đang dùng dữ liệu mẫu tại mã nguồn giao diện.

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
│   ├── components/
│   └── services/api.js
└── dist/                         # đầu ra sau khi chạy build
```

## Tệp và thư mục gốc

| Đường dẫn | Chức năng |
|---|---|
| `client/.env.example` | Mẫu biến `VITE_API_URL` cho URL API Express dự kiến; không chứa cấu hình thật. |
| `client/package.json` | Khai báo metadata, thư viện React/Vite/Tailwind và các lệnh `dev`, `build`, `preview`, `clean`, `lint`. |
| `client/package-lock.json` | Khóa chính xác phiên bản dependency để cài đặt nhất quán. |
| `client/vite.config.js` | Cấu hình Vite: React plugin, Tailwind plugin, alias `@` trỏ tới `client/`, và hành vi HMR/watch theo biến `DISABLE_HMR`. |
| `client/eslint.config.js` | Cấu hình ESLint cho JSX/React Hooks; bỏ qua `dist/` và `node_modules/`. |
| `client/index.html` | HTML shell, điểm gắn React `#root`, favicon và metadata cơ bản của trang. |
| `client/metadata.json` | Metadata mô tả sản phẩm và capability phía server dự kiến cho môi trường tạo mẫu. |
| `client/public/` | Tài nguyên tĩnh được Vite phục vụ nguyên trạng qua URL gốc. |
| `client/public/logo/logo.svg` | Logo mặc định được `UnitLogoDisplay` hiển thị khi chọn preset quốc phòng. |
| `client/public/images/HeroSection.jpg` | Ảnh nền phần hero/banner của trang chủ. |
| `client/dist/` | Tệp HTML, CSS/JS đã đóng gói và ảnh sao chép sau build; chỉ tái tạo bằng `npm run build`, không chỉnh sửa trực tiếp. |
| `client/assets/` | Thư mục dành cho tài nguyên cục bộ ở cấp client; hiện không có tệp đáng kể. |

## Mã nguồn `src/`

| Đường dẫn | Chức năng |
|---|---|
| `client/src/main.jsx` | Điểm khởi động React: tạo root, bật `StrictMode`, render `App` và nạp stylesheet chung. |
| `client/src/App.jsx` | Thành phần điều phối chính: quản lý tab điều hướng, trạng thái ba modal, người dùng hiện tại và logo đơn vị lưu trong `localStorage`; ghép các section của trang. |
| `client/src/index.css` | Nạp Tailwind, đặt kiểu nền/chữ cơ bản và utility nội bộ cho bóng đổ cùng kích thước vùng chạm. |
| `client/src/data.js` | Tập trung cấu hình hiển thị Z176, danh sách phòng ban và dữ liệu mẫu phục vụ giao diện thi/tra cứu hiện tại; cần thay thế bằng API an toàn khi có backend. |
| `client/src/services/` | Lớp tích hợp dịch vụ bên ngoài giao diện. |
| `client/src/services/api.js` | Đọc `VITE_API_URL`, gửi request JSON qua `fetch`, chuẩn hóa xử lý phản hồi lỗi và trả JSON hoặc `null` cho phản hồi 204. |
| `client/src/assets/` | Tài nguyên được import từ mã nguồn để Vite xử lý khi build. |
| `client/src/assets/images/military_banner_bg_1786353296945.jpg` | Ảnh nền quân đội có sẵn trong source; hiện `App.jsx` đang dùng ảnh hero trong `public/images/`. |
| `client/src/components/` | Các React component theo từng khối UI và modal. |

## Thành phần giao diện

| Đường dẫn | Chức năng |
|---|---|
| `client/src/components/Header.jsx` | Thanh điều hướng cố định; hỗ trợ menu desktop/mobile, cuộn tới section, mở modal đăng nhập/vào thi/chọn logo. |
| `client/src/components/Banner.jsx` | Hero giới thiệu đơn vị, tiêu đề cuộc thi và nút mở chọn logo. |
| `client/src/components/TimeAndCountdown.jsx` | Hiển thị thời gian diễn ra cuộc thi và bộ đếm ngược từng giây đến thời điểm cấu hình. |
| `client/src/components/CTAButton.jsx` | Nút hành động chính để mở luồng vào thi. |
| `client/src/components/RegulationsSection.jsx` | Section quy chế, cấu trúc bài thi, điều kiện đạt và hướng dẫn trước khi thi. |
| `client/src/components/QuickGuideSection.jsx` | Section mô tả bốn bước thao tác và nút bắt đầu bài thi. |
| `client/src/components/ResultsLookupSection.jsx` | Giao diện lọc/tra cứu kết quả theo mã, tên hoặc phòng ban bằng danh sách mẫu đang có ở client. |
| `client/src/components/ContactSection.jsx` | Section liên hệ hỗ trợ kỹ thuật và tổ chức; tạo liên kết gọi điện/email từ cấu hình chung. |
| `client/src/components/Footer.jsx` | Chân trang hiển thị thông tin đơn vị và liên hệ rút gọn. |
| `client/src/components/LoginModal.jsx` | Modal thu thập và kiểm tra tối thiểu thông tin đăng nhập ở phía client, rồi trả đối tượng người dùng lên `App`. Chưa xác thực qua server. |
| `client/src/components/ExamModal.jsx` | Modal luồng thi: xác nhận người dùng, trả lời câu hỏi, đếm thời gian, chấm điểm và hiển thị kết quả/thi lại. Hiện chạy hoàn toàn trên dữ liệu mẫu phía client. |
| `client/src/components/LogoSelectorModal.jsx` | Modal chọn preset hoặc tải logo cục bộ, kiểm tra định dạng/kích thước, nén ảnh bằng canvas và lưu cấu hình qua `App`. |
| `client/src/components/UnitLogoDisplay.jsx` | Khai báo danh sách logo preset và render logo preset hoặc ảnh tùy chỉnh theo cấu hình. |

## Luồng phụ thuộc chính

1. `index.html` tải `src/main.jsx`.
2. `main.jsx` render `App.jsx`.
3. `App.jsx` điều phối các section và modal trong `components/`.
4. Các component dùng `data.js` cho thông tin hiển thị/dữ liệu mẫu; khi backend được triển khai, các lời gọi nên đi qua `services/api.js`.
