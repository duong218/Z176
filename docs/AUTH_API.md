# Cơ chế xác thực & Phân quyền (Auth API)

Hệ thống Z176 áp dụng cơ chế xác thực kép thông qua JSON Web Token (JWT) kết hợp giữa Access Token ngắn hạn và Refresh Token dài hạn lưu trữ trong HttpOnly Cookie để đảm bảo an toàn tối đa.

## Các Endpoint Xác thực

| Method | Path | Xác thực | Mô tả |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Public | Đăng nhập hệ thống. Nhận vào `{ username, password }`. Trả về `accessToken` ở JSON body; set `refreshToken` vào Cookie bảo mật với thuộc tính `httpOnly`, `secure`, `sameSite: 'strict'`. |
| **POST** | `/api/auth/refresh` | Cookie | Sử dụng `refreshToken` trong cookie để cấp mới cặp token. Có cơ chế rotate token tự động. |
| **POST** | `/api/auth/logout` | Bearer | Đăng xuất người dùng. Thu hồi refresh token bằng cách tăng `tokenVersion` trong database của User, xóa cookie. |
| **GET** | `/api/auth/me` | Bearer | Trả về thông tin chi tiết tài khoản của người dùng hiện tại kèm theo thông tin vai trò (`role`) và hồ sơ nhân viên (`employee`). |
| **POST** | `/api/auth/change-password` | Bearer | Đổi mật khẩu tài khoản. Nhận `{ currentPassword, newPassword }`. Trường `mustChangePassword` chuyển thành `false` sau khi đổi thành công. |

## Quy trình Khởi động hệ thống (Database Seeding)
- Khi khởi động server lần đầu hoặc bật flag `SEED_ON_START`, hệ thống tự động kiểm tra và khởi tạo 4 vai trò mặc định (`admin`, `examiner`, `leader`, `candidate`) vào collection `roles`.
- Đồng thời, tạo tài khoản quản trị ban đầu dựa trên biến môi trường `ADMIN_SEED_EMAIL` (hoặc `ADMIN_SEED_USERNAME`) và `ADMIN_SEED_PASSWORD`. Tài khoản này được set `mustChangePassword: true` để yêu cầu bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.

## Kiểm soát đăng nhập nhiều thiết bị (Concurrent Session Control)
- Mỗi User lưu một trường `tokenVersion` (kiểu số nguyên) trong database.
- Mỗi khi người dùng thực hiện đăng nhập mới thành công hoặc đổi mật khẩu, `tokenVersion` trên DB của User sẽ tăng lên 1 đơn vị.
- Khi verify JWT, middleware `authenticate` sẽ giải mã access token để so sánh `tokenVersion` được đính kèm trong token với `tokenVersion` hiện tại của User trong cơ sở dữ liệu. Nếu không khớp (do tài khoản vừa đăng nhập ở thiết bị khác), token cũ ngay lập tức bị vô hiệu hóa (trả lỗi `401 Unauthorized`).
- Client định kỳ 5 giây sẽ gọi API kiểm tra hoạt động hoặc lắng nghe lỗi 401 để kích hoạt `SessionRevokedModal`, ngăn chặn thí sinh gian lận thi cử bằng cách đăng nhập tài khoản của mình trên nhiều thiết bị.

## Cách thức lưu trữ ở Client
- **Access Token**: Được lưu tạm thời trong bộ nhớ Javascript (State/Memory) hoặc biến cục bộ trong suốt phiên làm việc của trang. Không lưu Access Token vào `localStorage` hay `sessionStorage` để phòng tránh lỗ hổng bảo mật tấn công XSS đánh cắp token.
- **Refresh Token**: Được lưu hoàn toàn ở HttpOnly Cookie phía Backend quản lý, tự động đính kèm khi gọi API `/refresh` bằng cơ chế `credentials: 'include'`.
- Khi client mount ứng dụng, tiến hành gọi API `/refresh` đầu tiên để lấy Access Token ban đầu (Silent Refresh).
