# PROGRESS.md

## Trạng thái hiện tại

- **Module đang làm:** **FR-001 — Ngân hàng câu hỏi** (API backend xong; chờ bạn review trước FR-002).
- **Đã xong:**
  - Schema Mongoose + [docs/MONGOOSE_SCHEMA.md](docs/MONGOOSE_SCHEMA.md) (coi như đã OK khi bạn bảo “tiếp tục”).
  - **Auth:** login/refresh/logout/me/change-password; JWT access (Bearer) + refresh (httpOnly cookie); seed 4 role + admin từ env; khóa tài khoản + rate limit login.
  - Tích hợp FE Login form với API backend thành công.
  - **Dashboard Admin (Tài khoản - Kết nối API thật):** Đã hoàn thành API thực tế (`GET /api/users`, `POST /api/users`, `PATCH /users/:id/role`, `PATCH /users/:id/lock`, `POST /users/:id/reset-password`). Kết nối UI Tab tài khoản để thực hiện CRUD, reset pass (sinh mật khẩu tạm 6 chữ số), đổi role, khóa/mở khóa thực tế có ghi Audit Log. 
  - **Dashboard Admin (Overview, Audit Log, Backup - UI MVP):** Giữ dữ liệu Mock (admin.service.js) chờ API Backend thật.
  - **FR-001 (BE):** CRUD câu hỏi + đáp án, lọc/tìm kiếm; CRUD tối thiểu chủ đề & bộ phận; import Excel `POST /api/questions/import`; audit log (không lưu nội dung Q/A trong metadata).
- **Đang làm:** Chờ bạn duyệt thiết kế / code Dashboard Admin & review module FR-001.
- **Còn lại (Must Have):**
  1. Xây dựng API Backend thực tế cho Admin Dashboard (CRUD Users, Lấy Roles, Lấy Audit Logs, Tính Stats, Backup export).
  2. FR-002 sinh mã đề → FR-003 gán → FR-004 làm bài → FR-005 chấm điểm.
  3. FE: Màn hình ngân hàng câu hỏi / import.
- **Chạy thử:**
  - Copy `server/.env.example` → `server/.env` (đã có sẵn JWT + admin demo).
  - MongoDB local, rồi: `cd server && npm.cmd run dev` — lần đầu tự tạo role + **admin.demo**.
  - Hoặc: `npm.cmd run seed` (tạo admin nếu chưa có).
  - Đăng nhập demo: username **`admin.demo`**, password **`DemoAdmin@12345`** (trong `.env.example`, đổi trên máy bạn).

## Assumption phát sinh trong lúc code (ngoài prompt gốc)

- Import Excel: **tự tạo Topic** nếu chưa có (theo cột topic); **Department phải tồn sẵn** khi scope riêng.
- Cột Excel hỗ trợ (header không phân biệt hoa thường, có alias tiếng Việt): `topic`, `content`, `scope`, `department`, `questionKind`, `answerType`, `difficulty`, `option1`…`option8`, `correct` (vd `1` hoặc `1,3`).
- Xóa câu hỏi = **soft delete** (`isActive: false`).
- **`AuditLog`:** giữ model; ghi khi create/update/deactivate/import câu hỏi.

## Lịch sử (mới nhất lên trên)

- [2026-08-11] Seed admin demo: `SEED_ON_START` bật mặc định ở development; `server/.env.example` + `.env.example` có `admin.demo` / mật khẩu demo qua env. topics, departments, questions, import Excel; middleware `requirePasswordChanged`; deps `multer`, `xlsx`.
- [2026-08-11] Auth module (đã có trên đĩa trước session): routes `/api/auth/*`, seed roles/admin.
- [2026-08-11] Tạo `PROGRESS.md`; schema + khởi tạo server.

## SECURITY_BASELINE — FR-001 / Auth (tự review nhanh)

- [x] Route ngân hàng câu hỏi: `authenticate` + `requireRoleCodes('admin','examiner')`.
- [x] Không log nội dung câu hỏi/đáp án ra console.
- [x] Validate server (enum, scope/department, đáp án single/multiple).
- [x] Upload Excel giới hạn 5MB, xóa file tạm sau import.
- [ ] **Bạn review:** `auth.service.js`, `auth.middleware.js`, `question.service.js` trước merge.
