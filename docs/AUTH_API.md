# Auth API (module Must Have — bước 6.1)

**Pattern:** `node-express-boilerplate` (LIBRARY.md mục 4) + SECURITY_BASELINE.md mục 1–2, 7.

| Method | Path | Auth | Mô tả |
|--------|------|------|--------|
| POST | `/api/auth/login` | — | Body `{ username, password }`. Trả `accessToken` (JSON); refresh `httpOnly` cookie `refreshToken`. |
| POST | `/api/auth/refresh` | Cookie | Làm mới access + rotate refresh cookie. |
| POST | `/api/auth/logout` | Bearer | Thu hồi refresh (`tokenVersion++`), xóa cookie. |
| GET | `/api/auth/me` | Bearer | Hồ sơ + `roleCode` từ DB. |
| POST | `/api/auth/change-password` | Bearer | Body `{ currentPassword, newPassword }`; bắt buộc sau seed admin. |

**Seed:** Mỗi lần khởi động server — upsert 4 role (`admin`, `examiner`, `candidate`, `leader`). Tạo admin **một lần** nếu có `ADMIN_SEED_EMAIL` + `ADMIN_SEED_PASSWORD` và chưa tồn tại user đó (`mustChangePassword: true`).

**Phân quyền sau này:** `requireRoleCodes('admin', 'examiner')` trong `middlewares/auth.middleware.js` — mã role đọc từ collection `roles`, không enum cứng.

**Client:** Gửi `Authorization: Bearer <accessToken>`, `credentials: 'include'` cho refresh/logout. **Không** lưu access token vào `localStorage` (SECURITY_BASELINE).
