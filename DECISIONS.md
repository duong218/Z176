# DECISIONS.md — Nhật ký quyết định kỹ thuật (ADR log)
## Module Thi Chuyên Môn Nội Bộ — Z176
**Người thực hiện:** Phạm Ngọc Dương — VNUA | **Trạng thái:** Bản nháp chuẩn bị, chưa nhận đề tài chính thức

**Mục đích:** Khác với `NhatKyTienDo...xlsx` (ghi *đã làm gì, khi nào*), file này ghi **tại sao chọn X thay vì Y**. Dùng để:
1. Trả lời câu hỏi hội đồng bảo vệ khóa luận kiểu "tại sao em chọn MongoDB mà không phải PostgreSQL?" — có sẵn lý do, không phải ứng biến tại chỗ.
2. Khi AI (hoặc chính Dương) sau này quên vì sao trước đó quyết định vậy, đọc lại đây thay vì suy đoán lại từ đầu.
3. Khi AI đề xuất đổi hướng khác với quyết định đã chốt — bắt buộc đọc file này trước, nếu đề xuất mới hợp lý hơn thì thêm bản ghi mới (không sửa xóa bản ghi cũ) theo mẫu "Superseded by".

> ⚠️ Các quyết định đánh dấu 🔸 là **tạm thời**, dựa trên giả định — sẽ chốt lại hoặc giữ nguyên sau khi có kết quả khảo sát chính thức với Z176.

> 📖 Các thuật ngữ nghiệp vụ dùng trong file này (vd "phiên thi", "điểm liệt", "ngân hàng câu hỏi") theo đúng định nghĩa thống nhất trong `GLOSSARY.md` — nếu AI hoặc Dương dùng một từ khác nghĩa với glossary, ưu tiên sửa lại theo glossary trước khi ghi ADR mới, tránh lệch thuật ngữ giữa các file.

---

## Cách ghi 1 bản ghi mới

```
## ADR-XXX: <Tên quyết định ngắn gọn>
**Ngày:** dd/mm/yyyy | **Trạng thái:** Đề xuất / Đã chốt 🔸 (tạm) / Đã chốt ✅ (chính thức) / Superseded by ADR-YYY

**Bối cảnh:** Vấn đề cần quyết định là gì, tại sao phải chọn.

**Các phương án đã xét:**
- Phương án A — ưu / nhược
- Phương án B — ưu / nhược

**Quyết định:** Chọn phương án nào.

**Lý do:** Vì sao chọn — tiêu chí ưu tiên là gì (dễ maintain, quen thuộc, phù hợp hạ tầng Z176...).

**Hệ quả:** Ảnh hưởng gì tới phần khác của hệ thống, rủi ro đi kèm.
```

**Không sửa/xóa bản ghi cũ khi đổi quyết định** — thêm bản ghi mới, đánh dấu bản cũ là `Superseded by ADR-YYY`. Giữ lịch sử tư duy nguyên vẹn, hữu ích khi giải trình khóa luận.

---

## ADR-001: Chọn MongoDB thay vì PostgreSQL cho database chính
**Ngày:** 01/07/2026 | **Trạng thái:** 🔸 Tạm chốt — chờ khảo sát #26 xác nhận yêu cầu audit log của Z176

**Bối cảnh:** Cần chọn database chính cho hệ thống thi — lưu câu hỏi, đề thi, phiên thi, kết quả, audit log.

**Các phương án đã xét:**
- **MongoDB** — schema linh hoạt (câu hỏi có thể nhiều dạng: 1 đáp án/nhiều đáp án/đúng-sai, mỗi dạng field khác nhau), quen thuộc với stack Node.js/Express đã chọn, có sẵn skill `mongodb-schema-design` trong LIBRARY.md hỗ trợ quyết định embed vs reference.
- **PostgreSQL** — quan hệ chặt chẽ hơn, phù hợp hơn nếu Z176 yêu cầu audit log dạng transaction nghiêm ngặt (ACID) cho dữ liệu điểm/kết quả — vốn là dữ liệu nhạy cảm cần độ tin cậy cao.

**Quyết định:** MongoDB, cho giai đoạn MVP.

**Lý do:** Ưu tiên tốc độ phát triển và schema linh hoạt cho ngân hàng câu hỏi (nhiều dạng câu hỏi khác nhau) trong giai đoạn MVP. Đây là stack quen thuộc, giảm thời gian học lại giữa lúc gấp rút làm khóa luận.

**Hệ quả:** Nếu khảo sát cho thấy Z176 yêu cầu audit log/báo cáo dạng quan hệ chặt (vd đối chiếu điểm số phải có transaction ACID nghiêm ngặt) → cân nhắc chuyển sang PostgreSQL cho riêng phần kết quả/audit log, giữ MongoDB cho ngân hàng câu hỏi (kiến trúc polyglot persistence) — sẽ ghi ADR mới nếu xảy ra.

---

## ADR-002: JWT tự quản lý thay vì OAuth bên thứ 3 (Google/Facebook login)
**Ngày:** 01/07/2026 | **Trạng thái:** ✅ Đã chốt

**Bối cảnh:** Cần chọn cơ chế đăng nhập cho 3 role (Admin/Người ra đề/Thí sinh).

**Các phương án đã xét:**
- **JWT + bcrypt tự quản lý** — kiểm soát hoàn toàn trong nội bộ, không phụ thuộc dịch vụ bên ngoài.
- **OAuth Google/Facebook** — nhanh, quen thuộc với người dùng, nhưng gửi thông tin đăng nhập qua bên thứ ba.

**Quyết định:** JWT tự quản lý.

**Lý do:** Đây là hệ thống nội bộ quân đội (Z176) — không thể để thông tin đăng nhập của nhân sự đi qua dịch vụ OAuth công khai bên ngoài, vi phạm nguyên tắc bảo mật cơ bản cho môi trường nội bộ (xem SECURITY_BASELINE.md mục 4).

**Hệ quả:** Phải tự xây middleware auth, quản lý refresh token, không có "đăng nhập nhanh 1 chạm" như OAuth — chấp nhận đánh đổi để giữ dữ liệu trong tầm kiểm soát nội bộ.

---

## ADR-003: crypto.randomInt() thay vì Math.random() để trộn đề/đáp án
**Ngày:** 01/07/2026 | **Trạng thái:** ✅ Đã chốt

**Bối cảnh:** Cần thuật toán sinh số ngẫu nhiên để trộn thứ tự câu hỏi và đáp án mỗi lần thí sinh vào thi.

**Các phương án đã xét:**
- **Math.random()** — dễ dùng, có sẵn trong JS, nhưng không phải cryptographically secure (có thể dự đoán được nếu biết seed/state).
- **crypto.randomInt()** (Node.js `crypto` module) — cryptographically secure, chống dự đoán trước thứ tự trộn đề.

**Quyết định:** `crypto.randomInt()`.

**Lý do:** Đề thi là dữ liệu nhạy cảm — nếu thứ tự trộn đề có thể bị dự đoán, thí sinh có thể lợi dụng để đoán trước cấu trúc đề, ảnh hưởng tính công bằng của kỳ thi. Đây là nguyên tắc cứng, không thương lượng dù AI đề xuất khác (xem SKILLS.md mục 4.5).

**Hệ quả:** Không có, chi phí hiệu năng của `crypto.randomInt()` không đáng kể so với `Math.random()` ở quy mô hệ thống này.

---

## ADR-004: Không tích hợp dịch vụ logging/error-tracking cloud (giai đoạn MVP)
**Ngày:** 01/07/2026 | **Trạng thái:** 🔸 Tạm chốt — chờ xác nhận Ban CNTT Z176

**Bối cảnh:** Các dịch vụ như Sentry, LogRocket giúp debug lỗi production nhanh hơn, nhưng gửi dữ liệu (bao gồm có thể lẫn dữ liệu nhạy cảm trong log) ra server bên ngoài.

**Các phương án đã xét:**
- **Sentry/LogRocket bản cloud** — debug nhanh, dashboard trực quan.
- **Log nội bộ (file log / console có kiểm soát, không log nội dung câu hỏi-đáp án)** — chậm hơn khi debug nhưng không rò rỉ dữ liệu ra ngoài.

**Quyết định:** Log nội bộ, không dùng dịch vụ cloud, cho tới khi Ban CNTT Z176 xác nhận.

**Lý do:** Nguyên tắc tối thượng của dự án là không để dữ liệu nội bộ quân đội rò rỉ ra ngoài qua bất kỳ kênh nào — kể cả log lỗi vô tình chứa thông tin nhạy cảm (xem AGENT_RULES.md mục 2.1, SECURITY_BASELINE.md mục 3).

**Hệ quả:** Debug production khó hơn, cần kỷ luật log tốt (log có cấu trúc, đủ context nhưng không leak dữ liệu nhạy cảm) để bù lại.

---

## Việc còn để mở — chờ khảo sát chính thức

| ADR liên quan | Câu hỏi khảo sát | Có thể phải ghi ADR mới nếu |
|---|---|---|
| ADR-001 (MongoDB) | #26 | Z176 yêu cầu audit log dạng quan hệ chặt/ACID nghiêm ngặt |
| — (chưa có ADR) | #28 | Z176 bắt buộc framework/ngôn ngữ khác ngoài React+Node |
| — (chưa có ADR) | #29 | Quyết định on-premise vs cloud ảnh hưởng kiến trúc deploy |

---
*Mỗi khi chốt một quyết định kỹ thuật mới (đặc biệt sau buổi khảo sát chính thức) — thêm ADR mới vào đây, không chỉ ghi vào NhatKyTienDo...xlsx.*
