# Cấu trúc server

## Trạng thái hiện tại

Repository hiện **chưa có thư mục `server/` hoặc mã nguồn backend riêng**. Vì vậy không có route, controller, model, middleware, service hay cấu hình cơ sở dữ liệu phía server để liệt kê.

Phần `client/` có chuẩn bị các điểm tích hợp cho backend trong tương lai:

| Đường dẫn | Vai trò liên quan đến server |
|---|---|
| `client/.env.example` | Khai báo mẫu `VITE_API_URL=http://localhost:5000/api` làm base URL cho API dự kiến. |
| `client/src/services/api.js` | Wrapper `fetch` gửi JSON đến `VITE_API_URL`, báo lỗi khi HTTP response không thành công. |
| `client/package.json` | Có dependency `express` và `dotenv`, nhưng repository chưa chứa file khởi động Express hoặc mã backend sử dụng chúng. |
| `client/metadata.json` | Mô tả capability server-side cho môi trường tạo mẫu; không phải mã triển khai server. |

## Dữ liệu mock đã bỏ qua

Theo yêu cầu, không phân tích nội dung hay mô tả từng dữ liệu mock trong thư mục sau:

```text
mock-data/
├── auditLog.mock.json
├── examConfig.mock.json
├── exams.mock.json
├── examSessions.mock.json
├── questions.mock.json
├── results.mock.json
├── users.mock.json
└── README.md
```

`mock-data/` là phạm vi dữ liệu giả được quy ước tách riêng; khi có backend thực tế, không dùng tài liệu này để suy ra schema, logic phân quyền hay quy tắc bảo mật.

## Hướng cấu trúc dự kiến

Các tài liệu kỹ thuật trong repository có nêu hướng tổ chức Node.js/Express cho tương lai, nhưng đây mới là quy ước dự kiến, **không phải cấu trúc đang tồn tại**:

```text
server/
└── src/
    ├── config/
    ├── controllers/
    ├── middlewares/
    ├── models/
    ├── routes/
    └── services/
```

Khi backend được thêm vào, tài liệu này cần được cập nhật từ các tệp thật trong `server/`, đặc biệt là điểm khởi động ứng dụng, cấu hình môi trường, router, middleware xác thực/phân quyền, service nghiệp vụ, model và kiểm thử.
