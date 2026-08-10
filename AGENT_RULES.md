# AGENT_RULES.md — Quy tắc dùng AI Agent
## Module Thi Chuyên Môn Nội Bộ — Z176
**Người thực hiện:** Phạm Ngọc Dương — VNUA | **Trạng thái:** Bản nháp chuẩn bị, chưa nhận đề tài chính thức
**Mục đích:** Luật chơi bắt buộc khi dùng AI (Antigravity, Claude, Cursor, Codex...) để code/thiết kế đề tài này. Áp dụng cho cả bản thân Dương lẫn cho AI tự đọc và tuân theo.

> File này đứng trên LIBRARY.md và SKILLS.md — nghĩa là AI được phép lấy skill/repo trong LIBRARY.md, nhưng **mọi hành động đều phải tuân theo rule ở đây trước**.

---

## 1. Nguyên tắc tối thượng: Không dữ liệu thật trong AI tool

Đây là rủi ro #8 tự bản thân Dương đã xác định trong bảng đánh giá rủi ro dự án — quan trọng nhất vì đề tài dùng dữ liệu nội bộ quân đội.

1. 🔒 **Chỉ dùng dữ liệu mock/giả khi làm việc với bất kỳ AI tool nào** (kể cả Claude, Antigravity, Cursor, Codex, Gemini...). Dữ liệu thật (tên nhân viên Z176, câu hỏi thi thật, đáp án thật, kết quả thi thật) **không bao giờ** được paste vào prompt, đính kèm file, hay để AI đọc trực tiếp.
2. 🔒 Toàn bộ dữ liệu mock đặt trong `mock-data/` (đã quy định trong SKILLS.md) — AI chỉ được đọc từ thư mục này khi cần ví dụ dữ liệu.
3. 🔒 Dữ liệu thật chỉ được nhập vào hệ thống **sau khi deploy nội bộ**, thao tác trực tiếp bởi người có thẩm quyền, không qua AI.
4. 🔒 Nếu AI tự đề xuất "để tôi tạo dữ liệu mẫu dựa trên thông tin bạn cung cấp" và bạn lỡ đưa thông tin thật → dừng ngay, không cho AI tiếp tục xử lý, xóa message đó khỏi lịch sử chat nếu công cụ cho phép.

## 2. Không tự ý gửi dữ liệu ra ngoài

1. 🔒 Không tích hợp AI hoặc bất kỳ SDK/API bên thứ ba nào gửi dữ liệu hệ thống ra ngoài (analytics, error tracking cloud như Sentry, logging cloud...) nếu chưa xác nhận với Ban CNTT Z176.
2. 🔒 Không dùng AI code-review tool có tính năng "gửi toàn bộ repo lên cloud để phân tích" trên nhánh chứa dữ liệu thật.
3. 🔒 Khi dùng skill trong LIBRARY.md thuộc nhóm Bảo mật hoặc Database — kiểm tra kỹ skill đó có gửi dữ liệu đi đâu không trước khi chạy tự động hàng loạt.

## 3. Quy trình review code AI sinh ra

1. Mọi code AI generate liên quan đến: xác thực (auth), phân quyền (role check), mã hóa câu hỏi/đáp án, session thi — **bắt buộc Dương đọc và hiểu từng dòng trước khi merge**, không merge mù.
2. Với code không nhạy cảm (UI thuần, style, format) — có thể merge nhanh hơn nhưng vẫn cần chạy qua bộ test tối thiểu.
3. Ghi lại trong NhatKyTienDo_KhoaLuan file: phần nào do AI sinh, phần nào Dương tự viết/sửa tay — phục vụ giải trình minh bạch khi bảo vệ khóa luận.
4. Trước khi merge vào nhánh chính, đối chiếu code với mục "Do-Not-Touch" trong SKILLS.md (mục 4) — 5 nguyên tắc cứng không được vi phạm dù AI đề xuất khác.

## 4. Khi AI đề xuất lệch khỏi quy ước

1. Nếu AI đề xuất giải pháp vi phạm nguyên tắc trong SKILLS.md hoặc AGENT_RULES.md (vd: dùng `Math.random()` để trộn đề, hardcode dữ liệu thật, bỏ qua middleware auth "để test nhanh") → **từ chối, yêu cầu AI làm lại đúng quy ước**, không tự sửa tay rồi bỏ qua gốc rễ vấn đề.
2. Nếu yêu cầu của Dương chưa đủ rõ ràng (vd: "làm phần phân quyền cho tôi" mà chưa nói rõ role nào được làm gì) → AI phải hỏi lại trước khi code, không tự đoán — dùng skill `trailofbits/ask-questions-if-underspecified` trong LIBRARY.md cho việc này.
3. Nếu 2 AI tool (vd Claude và Cursor) đưa ra 2 cách làm khác nhau cho cùng 1 vấn đề bảo mật → dừng lại, hỏi GVHD hoặc tự nghiên cứu thêm, không chọn đại theo cảm tính.

## 5. Phạm vi AI được tự chủ vs. cần xác nhận

| Loại việc | AI được tự làm | Cần Dương xác nhận trước |
|---|---|---|
| Viết UI component, style, skeleton loading | ✅ | |
| Viết CRUD cơ bản (không đụng câu hỏi/đáp án) | ✅ | |
| Sửa bug không liên quan bảo mật | ✅ | |
| Thiết kế schema DB cho câu hỏi/đáp án/kết quả | | ✅ |
| Logic phân quyền, middleware auth | | ✅ |
| Cấu hình mã hóa, hashing, session | | ✅ |
| Tích hợp bất kỳ service/API bên thứ 3 nào | | ✅ |
| Thao tác với dữ liệu thật (mọi giai đoạn) | | ✅ (và không qua AI) |

## 6. Ghi log & minh bạch

- Mỗi phiên làm việc quan trọng với AI (đặc biệt phần bảo mật/phân quyền) nên lưu lại tóm tắt vào NhatKyTienDo_KhoaLuan_PhamNgocDuong.xlsx (cột "Chi tiết / Mô tả cụ thể" hoặc "Ghi chú").
- Nếu GVHD hoặc hội đồng hỏi "phần này AI làm hay em tự làm" — có thể trả lời rõ ràng nhờ nhật ký này, tránh bị nghi ngờ về tính học thuật của khóa luận.

---
*File này sẽ bổ sung thêm sau khi khảo sát chính thức, đặc biệt nếu Z176 có quy định riêng về dùng AI trong hệ thống nội bộ (câu hỏi khảo sát #28 có thể hé lộ điều này).*
