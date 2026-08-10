# SKILLS.md — Quy ước kỹ thuật
## Module Thi Chuyên Môn Nội Bộ — Z176
**Người thực hiện:** Phạm Ngọc Dương — VNUA | **Trạng thái:** Bản nháp chuẩn bị, chưa nhận đề tài chính thức
**Mục đích:** Là "luật chơi" kỹ thuật cho bản thân và cho AI tool (Cursor/Claude/Copilot...) khi bắt đầu code, tránh việc AI generate lệch convention hoặc đụng vào phần nhạy cảm.

> ⚠️ File này sẽ được cập nhật lại sau buổi khảo sát chính thức (đặc biệt câu 26-30 về hạ tầng), hiện tại các mục đánh dấu 🔸 là **giả định tạm**, cần chốt lại sau khi có câu trả lời khảo sát.

---

## 1. Tech Stack (dự kiến)

| Layer | Lựa chọn mặc định | Ghi chú |
|---|---|---|
| Frontend | React 18 + Vite | Đổi nếu Z176 yêu cầu framework khác (câu hỏi #28) |
| Styling | Tailwind CSS | |
| Backend | Node.js + Express | |
| Database | MongoDB | 🔸 Cân nhắc PostgreSQL nếu đơn vị yêu cầu dữ liệu quan hệ chặt chẽ hơn cho audit log |
| Auth | JWT + bcrypt, role-based | Không dùng OAuth bên thứ 3 công khai (Google/Facebook login) — môi trường nội bộ |
| Deploy | 🔸 Chờ khảo sát #26: on-premise hay cloud | Chuẩn bị sẵn 2 phương án: Docker cho on-prem, Render/Vercel cho demo local |

**Nguyên tắc chọn stack:** Ưu tiên những gì đơn vị CNTT Z176 có thể tự maintain sau khi khóa luận kết thúc (câu hỏi #30), không chọn công nghệ quá kén người bảo trì.

---

## 2. Cấu trúc thư mục chuẩn

```
exam-system/
├── client/                  # React app
│   ├── src/
│   │   ├── components/      # UI components, chia theo domain (exam/, question/, report/)
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/        # gọi API, KHÔNG chứa business logic
│   │   ├── contexts/        # AuthContext, ExamSessionContext
│   │   └── utils/
├── server/
│   ├── src/
│   │   ├── models/           # Mongoose schema
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/      # auth, role-check, audit-log
│   │   ├── services/         # business logic tách khỏi controller
│   │   └── config/
├── docs/                     # UML, ERD, đặc tả nghiệp vụ
└── mock-data/                 # DỮ LIỆU GIẢ dùng khi làm việc với AI — xem AGENT_RULES.md
```

**Quy tắc:** Controller mỏng, Service dày (business logic nằm ở service, không nằm ở controller/route).

---

## 3. Coding Convention

- **Naming:** camelCase cho biến/hàm, PascalCase cho component/model, kebab-case cho tên file route.
- **Commit message:** `feat/fix/refactor/docs: mô tả ngắn` — để sau này viết báo cáo khóa luận dễ trace lại quá trình.
- **Không magic number:** mọi cấu hình đề thi (số câu, thời gian, điểm liệt) đưa vào bảng cấu hình (`ExamConfig`), không hardcode.
- **Validation:** validate ở cả client (UX) và server (bắt buộc, không tin client).
- **Error handling:** trả lỗi theo format chuẩn `{ success, message, code }`, không leak stack trace ra response ở production.

---

## 4. Danh sách "Do-Not-Touch" / Nguyên tắc cứng ngay từ đầu

Đây là các nguyên tắc **không được vi phạm dù AI đề xuất khác**, vì gắn với đặc thù dữ liệu quân đội nội bộ:

1. 🔒 **Không bao giờ lưu đáp án/câu hỏi ở dạng chưa mã hóa hoàn toàn rõ ràng trong log hoặc console.log khi debug** — kể cả môi trường dev.
2. 🔒 **Không tự ý tích hợp API/SDK bên thứ ba gửi dữ liệu ra ngoài** (analytics, error tracking như Sentry bản cloud...) trừ khi đã xác nhận với Ban CNTT.
3. 🔒 **Không dùng tài khoản demo/test có thông tin thật của nhân viên Z176.**
4. 🔒 **Mọi endpoint liên quan đề thi/đáp án đều phải qua middleware kiểm tra role**, không có "endpoint tạm bỏ qua auth để test nhanh" còn sót lại khi deploy.
5. 🔒 **Không dùng thư viện sinh số ngẫu nhiên không an toàn (`Math.random()`) cho việc trộn đề/đáp án** — dùng `crypto.randomInt()` hoặc tương đương.

---

## 5. Việc còn để mở — chờ khảo sát chính thức

| Mục | Câu hỏi khảo sát liên quan | Ảnh hưởng tới skill này |
|---|---|---|
| Ngôn ngữ/framework bắt buộc | #28 | Có thể phải viết lại toàn bộ mục 1 |
| On-premise vs cloud | #26, #29 | Ảnh hưởng chiến lược deploy, offline-first hay không |
| Kết nối HR có sẵn | #23 | Quyết định có cần module quản lý user riêng hay chỉ đồng bộ |
| Yêu cầu bảo mật đề thi đặc thù | #13, #35 | Bổ sung thêm rule mã hóa/log vào mục 4 |

---
*File này là bản chuẩn bị trước khi nhận đề tài chính thức — cập nhật sau buổi khảo sát với Z176.*
