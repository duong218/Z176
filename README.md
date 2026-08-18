# HỆ THỐNG THI TRẮC NGHIỆM CHUYÊN MÔN NỘI BỘ Z176
> **SẢN PHẨM KHÓA LUẬN TỐT NGHIỆP**
> * Sinh viên thực hiện: **Phạm Ngọc Dương**
> * Mã lớp / Khóa: **K67**
> * Trường: **Học viện Nông nghiệp Việt Nam**

---

## 1. Giới thiệu chung

Hệ thống thi trắc nghiệm chuyên môn nội bộ Z176 là giải pháp phần mềm được nghiên cứu và phát triển nhằm tự động hóa quy trình tổ chức thi đánh giá năng lực, tay nghề chuyên môn dành cho cán bộ và công nhân viên tại **Nhà máy Z176 - Bộ Quốc phòng**. 

Hệ thống giúp tối ưu hóa từ khâu soạn đề đề xuất, phê duyệt & phát hành mã đề thi (tự động xáo trộn câu hỏi và đáp án), giám sát thời gian làm bài thời gian thực (realtime) với cơ chế tự động nộp bài khi thí sinh rời ca thi, cho đến khâu chấm điểm tự động và xuất báo cáo kết quả chi tiết theo định dạng Excel chuẩn.

---

## 2. Tổng quan công nghệ sử dụng

Hệ thống được phát triển theo mô hình Client-Server phân lớp rõ ràng, đảm bảo hiệu năng và tính bảo mật cao:

### Client (Frontend)
*   **Framework**: [React 19](https://react.dev/) & [Vite](https://vite.dev/) (Tối ưu tốc độ tải và xây dựng gói bundle cực nhanh).
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Hệ thống thiết kế tối giản, hiện đại và chuẩn Responsive).
*   **Hiệu ứng & Hoạt ảnh**: [Lenis Smooth Scroll](https://github.com/darkroomengineering/lenis) (Cuộn trang mượt mà) & [Motion](https://motion.dev/) (Micro-animations sinh động).
*   **Trực quan hóa dữ liệu**: [Recharts](https://recharts.org/) (Biểu đồ thống kê kết quả thi cho Admin & Leader).
*   **Icons**: [Lucide React](https://lucide.dev/).

### Server (Backend)
*   **Runtime**: Node.js (Phiên bản `>=22.0.0 <25.0.0`).
*   **Framework**: Express.js (Xây dựng API RESTful).
*   **Cơ sở dữ liệu**: MongoDB & Mongoose ODM.
*   **Bảo mật**: 
    *   `Helmet` bảo vệ các HTTP headers.
    *   CORS cấu hình an toàn cho phép giao tiếp giữa Client và Server.
    *   `express-rate-limit` giới hạn tần suất các yêu cầu nhạy cảm như Đăng nhập và Thao tác làm bài thi.
*   **Xử lý tệp tin**: `exceljs` & `xlsx` (Hỗ trợ đọc/xuất báo cáo Excel chuyên nghiệp); `multer` hỗ trợ tải tài liệu ôn tập và hình ảnh.

---

## 3. Quản lý và Lưu trữ dữ liệu

Hệ thống tổ chức dữ liệu một cách chặt chẽ và lưu trữ trên các nền tảng đám mây hiện đại:

| Loại dữ liệu | Nguồn gốc / Cơ chế hoạt động | Nơi lưu trữ chính |
| :--- | :--- | :--- |
| **Thông tin tài khoản, cấu trúc tổ chức** | Được import ban đầu thông qua file Excel chuẩn của nhà máy hoặc do Admin khởi tạo trực tiếp trên giao diện quản trị. | **MongoDB Atlas** (Cơ sở dữ liệu đám mây dạng NoSQL). |
| **Ngân hàng đề thi & Câu hỏi** | Do Người ra đề (`examiner`) soạn thảo hoặc nhập hàng loạt qua Excel, phân loại theo độ khó và chủ đề. | **MongoDB Atlas** (Chứa nội dung văn bản, đáp án và liên kết ảnh). |
| **Hình ảnh minh họa câu hỏi** | Được tải lên từ máy tính của Người ra đề khi soạn thảo ngân hàng đề. | **Cloudinary** (Lưu trữ và tối ưu hóa hình ảnh đám mây). |
| **Tài liệu ôn tập (.pdf, .docx, .xlsx)** | Do Người ra đề / Admin tải lên nhằm hỗ trợ thí sinh ôn luyện lý thuyết theo từng phòng ban chuyên môn. | **Cloudinary** (Dạng raw resources, tải và xem trực tuyến thông qua cơ chế Token bảo mật). |
| **Kết quả và Lịch sử thi** | Do máy chủ tự động chấm điểm ngay sau khi thí sinh nộp bài hoặc khi ca thi tự động hết giờ. | **MongoDB Atlas** (Bảng kết quả `results` và chi tiết đáp án thí sinh chọn `candidate-answers`). |
| **Nhật ký hệ thống (Audit Logs)** | Tự động ghi lại các hành động nhạy cảm của người dùng (như reset mật khẩu, CRUD câu hỏi, thay đổi vai trò). | **MongoDB Atlas** (Bảng `auditlogs` dành riêng cho quản trị viên kiểm tra an ninh). |

---

## 4. Mô hình Phân quyền người dùng

Hệ thống phân chia rõ ràng 4 nhóm vai trò nghiệp vụ khác nhau:

```text
               ┌─────────────── Đăng Nhập Hệ Thống ───────────────┐
               │                                                  │
       [ Thí sinh ]         [ Người ra đề ]        [ Người duyệt ]     [ Quản trị viên ]
       (candidate)            (examiner)              (leader)             (admin)
            │                      │                      │                   │
  - Học tập tài liệu     - Quản lý chủ đề       - Duyệt đề đề xuất   - Quản lý User
  - Làm bài kiểm tra     - Biên soạn câu hỏi    - Phát hành kỳ thi   - Xem Audit Log
  - Xem điểm cá nhân     - Đề xuất đề thi       - Xem báo cáo tổng   - Thống kê toàn bộ
```

1.  **Thí sinh (Candidate)**: Học tập tài liệu ôn tập được phân phối riêng cho phòng ban mình, vào phòng thi thực hiện làm bài kiểm tra trắc nghiệm, và tra cứu kết quả cá nhân.
2.  **Người ra đề (Examiner)**: Quản lý phòng ban, chủ đề, biên soạn ngân hàng câu hỏi, upload tài liệu ôn tập và soạn thảo đề xuất kỳ thi đệ trình lên cấp trên.
3.  **Người duyệt đề (Leader)**: Phê duyệt đề thi, xuất bản kỳ thi chính thức (sinh các mã đề thi ngẫu nhiên cho thí sinh), xem thống kê kết quả thi toàn diện của từng phòng ban, và cấp thêm lượt thi khi cần thiết.
4.  **Quản trị viên (Admin)**: Quản trị tài khoản (tạo mới, import/export Excel, phân quyền, khóa/mở khóa), cấu hình logo giao diện hiển thị, và theo dõi nhật ký hoạt động hệ thống (Audit Logs).

---
*Bản quyền sản phẩm thuộc về tác giả Phạm Ngọc Dương - Sinh viên K67 - Khoa Công nghệ thông tin - Học viện Nông nghiệp Việt Nam.*