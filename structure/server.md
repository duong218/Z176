# Cấu trúc server

## Phạm vi và trạng thái

`server/` là API Express dùng MongoDB/Mongoose. Dự án dùng Node `>=22 <25` (xem `.nvmrc` ở thư mục gốc). Tài liệu này chỉ mô tả cấu trúc mã nguồn hiện có; không thay thế yêu cầu rà soát bảo mật, phân quyền và schema trước khi triển khai dữ liệu thật.

```text
server/
├── .env.example
├── package.json
├── package-lock.json
└── src/
    ├── index.js
    ├── app.js
    ├── config/
    │   ├── db.js
    │   └── env.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── department.controller.js
    │   ├── question.controller.js
    │   ├── role.controller.js
    │   ├── topic.controller.js
    │   └── user.controller.js
    ├── middlewares/
    │   ├── auth.middleware.js
    │   ├── rate-limit.middleware.js
    │   ├── require-password-changed.middleware.js
    │   └── upload.middleware.js
    ├── models/
    │   ├── constants.js
    │   ├── index.js
    │   ├── answer.model.js
    │   ├── audit-log.model.js
    │   ├── candidate-answer.model.js
    │   ├── department.model.js
    │   ├── employee.model.js
    │   ├── exam.model.js
    │   ├── exam-attempt.model.js
    │   ├── exam-candidate.model.js
    │   ├── exam-code.model.js
    │   ├── exam-code-question.model.js
    │   ├── question.model.js
    │   ├── result.model.js
    │   ├── role.model.js
    │   ├── schedule.model.js
    │   ├── study-document.model.js
    │   ├── topic.model.js
    │   └── user.model.js
    ├── routes/
    │   ├── index.js
    │   ├── auth.routes.js
    │   ├── department.routes.js
    │   ├── question.routes.js
    │   ├── role.routes.js
    │   ├── topic.routes.js
    │   └── user.routes.js
    ├── scripts/
    │   ├── backup-cli.js
    │   └── seed-cli.js
    ├── services/
    │   ├── audit.service.js
    │   ├── auth.service.js
    │   ├── department.service.js
    │   ├── question.service.js
    │   ├── role.service.js
    │   ├── seed.service.js
    │   ├── topic.service.js
    │   └── user.service.js
    └── utils/
        ├── api-error.js
        └── async-handler.js
```

## Thành phần chính

| Đường dẫn | Chức năng |
|---|---|
| `src/index.js` | Kiểm tra biến môi trường, kết nối MongoDB, chạy seed khởi tạo theo cấu hình và khởi động HTTP server. |
| `src/app.js` | Cấu hình Express, Helmet, CORS, cookie parser, JSON body parser, `/api/health`, router API và xử lý lỗi chuẩn. |
| `src/config/` | Đọc/kiểm tra biến môi trường và tạo kết nối MongoDB. |
| `src/routes/` | Khai báo route theo miền nghiệp vụ và gắn middleware trước controller. |
| `src/controllers/` | Nhận request, gọi service và trả response HTTP. |
| `src/services/` | Chứa logic nghiệp vụ: xác thực, audit, phòng ban, chủ đề, câu hỏi và seed. |
| `src/models/` | Các schema Mongoose và hằng số miền nghiệp vụ. |
| `src/middlewares/` | Xác thực, kiểm tra role, giới hạn tần suất đăng nhập, yêu cầu đổi mật khẩu và nhận tệp Excel. |
| `src/scripts/` | Các lệnh CLI seed và sao lưu. |
| `src/utils/` | `ApiError` và helper bọc hàm bất đồng bộ. |

## API hiện có

| Tiền tố | Route | Ghi chú |
|---|---|---|
| `/api` | `GET /health` | Kiểm tra trạng thái dịch vụ. |
| `/api/auth` | `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /change-password` | Nhóm endpoint xác thực. Đăng xuất, hồ sơ và đổi mật khẩu yêu cầu xác thực. |
| `/api/topics` | `GET /`, `POST /` | Chủ đề; yêu cầu role `admin` hoặc `examiner` và mật khẩu đã được đổi. |
| `/api/departments` | `GET /`, `POST /` | Phòng ban; cùng điều kiện bảo vệ như chủ đề. |
| `/api/questions` | `GET /`, `POST /import`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` | Ngân hàng câu hỏi; tất cả route đều qua xác thực, role và kiểm tra đổi mật khẩu. |
| `/api/roles` | `GET /` | Danh sách role; chỉ `admin` sau khi đã đổi mật khẩu. |
| `/api/users` | `GET /`, `POST /`, `PATCH /:id/role`, `PATCH /:id/lock`, `POST /:id/reset-password` | Quản lý tài khoản; chỉ `admin` sau khi đã đổi mật khẩu. |

## Biến môi trường và tích hợp client

- Mẫu biến môi trường: `env.example` ở root và `server/.env.example`.
- Client gọi API qua `client/src/services/api.js`, lấy base URL từ `VITE_API_URL` (mặc định `http://localhost:5000/api`).
- `client/src/services/auth.service.js` hiện đã cung cấp helper đăng nhập, refresh token, lấy hồ sơ và đăng xuất.
- Chỉ dùng dữ liệu mock khi phát triển cùng AI; không seed hoặc ghi dữ liệu thật của Z176 qua workflow này.
