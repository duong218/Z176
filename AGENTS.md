# AGENTS.md — Đọc file này ĐẦU TIÊN, trước mọi hành động
## Module Thi Chuyên Môn Nội Bộ — Z176
**Người thực hiện:** Phạm Ngọc Dương — VNUA
**Trạng thái dự án:** 🟡 Giai đoạn 1 — Chuẩn bị trước khi nhận đề tài chính thức (chưa có quyết định giao đề tài, chưa khảo sát thực địa)

> Đây là file "cổng vào" (entry point). Antigravity/Claude/Cursor/Codex khi mở project này phải đọc file này trước, rồi mới đọc tiếp 3 file bên dưới theo đúng thứ tự ưu tiên. Không nhảy thẳng vào code khi chưa nắm được 4 mục dưới đây.

---

## 0. Trạng thái thật hiện tại (để AI không ảo tưởng tiến độ)

- ❌ **Chưa nhận đề tài chính thức** từ GVHD/khoa — mọi thứ đang là bản nháp chuẩn bị.
- ❌ **Chưa khảo sát thực địa tại Z176** — bộ câu hỏi khảo sát (42 câu) đã soạn xong nhưng chưa dùng.
- ❌ **Chưa có dòng code nào của hệ thống thật** — mới chỉ có tài liệu quy ước (SKILLS.md, LIBRARY.md, AGENT_RULES.md) và file khảo sát/nhật ký.
- ✅ Đã hoàn thành: bộ câu hỏi khảo sát MVP, quy ước kỹ thuật, thư viện skill, luật dùng AI.
- 🔸 Nhiều quyết định kỹ thuật (framework bắt buộc, on-premise vs cloud, kết nối HR sẵn có...) đang là **giả định tạm**, chờ câu trả lời khảo sát #23, #26, #28, #29, #30, #13, #35.

**Hệ quả cho AI:** Nếu người dùng yêu cầu "code luôn module X" — nhắc rằng đề tài chưa chính thức, các giả định trong SKILLS.md có thể đổi sau khảo sát, và hỏi lại xem có nên tiếp tục trên giả định hiện tại hay không (theo mục 4.2 của AGENT_RULES.md).

---

## 1. Thứ tự đọc bắt buộc

| Ưu tiên | File | Vai trò |
|---|---|---|
| 1 (cao nhất, đứng trên tất cả) | `AGENT_RULES.md` | Luật chơi khi dùng AI — đặc biệt mục "Không dữ liệu thật trong AI tool". Vi phạm file này là vi phạm nghiêm trọng nhất. |
| 2 | `SKILLS.md` | Quy ước kỹ thuật + mục 4 "Do-Not-Touch" (5 nguyên tắc cứng, không được vi phạm dù AI đề xuất khác). |
| 3 | `LIBRARY.md` | Tra skill/repo theo nhóm việc (BA, Design, FE, BE, DB, Bảo mật, Testing...) — chỉ dùng sau khi đã qua bộ lọc của 2 file trên. |
| — | `SYNC_PROTOCOL.md` | **Kích hoạt riêng** khi đã nhận đề tài chính thức VÀ khảo sát Z176 đã có câu trả lời — quy trình 9 bước để cập nhật đồng bộ tất cả file trên, tránh sót file khi giả định 🔸 chuyển thành ✅. Bình thường (giai đoạn hiện tại) bỏ qua file này. |
| — | `GLOSSARY.md` | Tên gọi chuẩn cho thuật ngữ nghiệp vụ (đề thi, phiên thi, ngân hàng câu hỏi...) và role — tra song song với LIBRARY.md khi đặt tên biến/model/route, tránh đặt tên lệch giữa các lần code khác nhau. |
| — | `NhatKyTienDo_KhoaLuan_PhamNgocDuong.xlsx` | Ghi lại mỗi phiên làm việc quan trọng vào đây (đặc biệt phần bảo mật/phân quyền), không chỉ đọc mà còn phải **cập nhật**. |
| — | `KhaoSat_MVP_KhoaLuan_PhamNgocDuong.xlsx` | Nguồn 42 câu khảo sát MVP — tham khảo khi cần hiểu phạm vi nghiệp vụ dự kiến, chưa có câu trả lời thật. |

---

## 2. 5 nguyên tắc cứng (nhắc lại để không cần mở SKILLS.md mỗi lần) — KHÔNG BAO GIỜ VI PHẠM

1. 🔒 Không log/console.log câu hỏi-đáp án dạng chưa mã hóa, kể cả môi trường dev.
2. 🔒 Không tự ý tích hợp API/SDK bên thứ ba gửi dữ liệu ra ngoài khi chưa xác nhận Ban CNTT.
3. 🔒 Không dùng tài khoản demo/test chứa thông tin thật của nhân viên Z176.
4. 🔒 Mọi endpoint đề thi/đáp án phải qua middleware kiểm tra role — không có "endpoint tạm bỏ auth để test nhanh".
5. 🔒 Không dùng `Math.random()` để trộn đề/đáp án — dùng `crypto.randomInt()` hoặc tương đương.

## 3. Nguyên tắc tối thượng (nhắc lại từ AGENT_RULES.md)

🔒 **Không bao giờ đưa dữ liệu thật của Z176 (tên nhân viên, câu hỏi thi thật, đáp án thật, kết quả thi thật) vào bất kỳ AI tool nào** — chỉ dùng dữ liệu mock trong `mock-data/`. Nếu vô tình dán dữ liệu thật → dừng ngay, không xử lý tiếp, xóa khỏi lịch sử chat nếu có thể.

## 4. Bảng tự chủ nhanh — AI được tự làm gì / phải hỏi trước

| AI tự làm | Phải hỏi Dương trước |
|---|---|
| UI component, style, skeleton loading | Schema DB câu hỏi/đề thi/kết quả |
| CRUD cơ bản không đụng câu hỏi/đáp án | Logic phân quyền, middleware auth |
| Sửa bug không liên quan bảo mật | Mã hóa, hashing, session |
| | Tích hợp service/API bên thứ 3 |
| | Mọi thao tác dữ liệu thật (và luôn luôn KHÔNG qua AI) |

---

## 5. Checklist đầu phiên làm việc (AI tự chạy qua trong đầu trước khi trả lời)

- [ ] Đề tài đã chính thức chưa? (Chưa — xem mục 0) → nếu người dùng có vẻ quên, nhắc nhẹ.
- [ ] **Nếu đề tài đã chính thức VÀ khảo sát đã có câu trả lời mới** → hỏi Dương có muốn chạy `SYNC_PROTOCOL.md` để đồng bộ các file trước khi code tiếp không, thay vì tự code trên giả định cũ.
- [ ] Yêu cầu có đụng vào dữ liệu thật không? → nếu có, từ chối, dẫn về mục 3.
- [ ] Yêu cầu có đụng 1 trong 5 nguyên tắc cứng (mục 2) không?
- [ ] Yêu cầu thuộc nhóm "cần xác nhận" trong bảng mục 4 không? → nếu có, hỏi lại thay vì tự code.
- [ ] Yêu cầu có rõ ràng đủ để làm không? Nếu mơ hồ ở phần nhạy cảm (phân quyền, bảo mật) → hỏi lại, không đoán (dùng skill `ask-questions-if-underspecified` trong LIBRARY.md).
- [ ] Sau khi làm xong phần quan trọng (đặc biệt bảo mật/phân quyền) → nhắc Dương ghi vào NhatKyTienDo...xlsx.

---
*File này là điểm tựa để AI không "quên context" giữa các phiên — cập nhật mục 0 (trạng thái) mỗi khi có mốc mới: nhận đề tài chính thức, hoàn thành khảo sát thực địa, chốt tech stack.*
