# Cấu trúc server

## Phạm vi

`server/` là API Express dùng MongoDB/Mongoose, Node `>=22 <25`. Tài liệu phản ánh mã nguồn hiện có; mọi thay đổi schema, xác thực và phân quyền vẫn cần được rà soát theo quy ước dự án trước khi triển khai dữ liệu thật.

```text
server/
├── .env.example
├── package.json
├── package-lock.json
├── test_rate_limit.js
└── src/
    ├── app.js
    ├── index.js
    ├── config/{db,env}.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── department.controller.js
    │   ├── question.controller.js
    │   ├── report.controller.js
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
    │   ├── report.routes.js
    │   ├── role.routes.js
    │   ├── topic.routes.js
    │   └── user.routes.js
    ├── scripts/{backup-cli,seed-cli}.js
    ├── services/
    │   ├── audit.service.js
    │   ├── auth.service.js
    │   ├── department.service.js
    │   ├── question.service.js
    │   ├── report.service.js
    │   ├── role.service.js
    │   ├── seed.service.js
    │   ├── topic.service.js
    │   └── user.service.js
    └── utils/{api-error,async-handler}.js
```

## Thành phần và API

| Nhóm | Chức năng |
|---|---|
| `app.js`, `index.js`, `config/` | Khởi tạo Express, middleware cơ sở, kiểm tra môi trường, kết nối MongoDB và khởi động dịch vụ. |
| `controllers/`, `services/`, `models/` | Tách lớp HTTP, nghiệp vụ và persistence cho auth, người dùng, role, chủ đề, phòng ban, câu hỏi và báo cáo. |
| `middlewares/` | Xác thực, kiểm tra role, giới hạn đăng nhập, đổi mật khẩu và nhận Excel. |
| `scripts/` | Lệnh seed và sao lưu. |
| `test_rate_limit.js` | Kiểm tra thủ công hành vi giới hạn tần suất. |

| Tiền tố API | Endpoint hiện có |
|---|---|
| `/api` | `GET /health` |
| `/api/auth` | `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `POST /change-password` |
| `/api/topics` | `GET /`, `POST /` |
| `/api/departments` | `GET /`, `POST /` |
| `/api/questions` | `GET /`, `POST /import`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `/api/users` | `GET /`, `POST /`, `PATCH /:id/role`, `PATCH /:id/lock`, `POST /:id/reset-password` |
| `/api/roles` | `GET /` |
| `/api/reports` | `GET /overview`, `GET /by-department`, `GET /results`, `GET /export` |

`/api/reports` yêu cầu role `leader` hoặc `admin`; các route quản lý ngân hàng câu hỏi yêu cầu xác thực, role phù hợp và mật khẩu đã được đổi. Client sử dụng `VITE_API_URL` để kết nối API.
