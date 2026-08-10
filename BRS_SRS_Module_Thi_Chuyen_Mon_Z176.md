# BUSINESS REQUIREMENT / SYSTEM REQUIREMENT SPECIFICATION (SƠ BỘ)
## Module hỗ trợ thi chuyên môn nghiệp vụ giỏi

**Đơn vị áp dụng:** Nội bộ doanh nghiệp (Z176)
**Người thực hiện:** Dương — Đồ án tốt nghiệp IT, VNUA
**Vai trò tài liệu:** Cơ sở cho Use Case → Activity Diagram → ERD → API → UI → Prototype
**Trạng thái:** Bản nháp v1.1 — bổ sung FR-008 (tài liệu ôn tập); nhiều mục còn TBD, cần BA/đơn vị nghiệp vụ xác nhận

---

## GHI CHÚ VỀ CÁC QUYẾT ĐỊNH ĐÃ CHỐT TẠM (theo trao đổi với người thực hiện đồ án)

Ba điểm sau **chưa phải là xác nhận chính thức từ BA công ty**, mà là định hướng thiết kế được người thực hiện đồ án chọn để làm cơ sở phân tích tiếp — vẫn cần đối chiếu lại với BA thật khi khảo sát:

1. **Cơ chế "mỗi thí sinh một mã đề":** Hệ thống sinh trước **nhiều mã đề** (mỗi mã đề gồm N câu, N có thể cấu hình 30/40/50) từ ngân hàng câu hỏi, sao cho **số mã đề sinh ra đủ cho số thí sinh dự thi** và **không có hai mã đề nào giống hệt nhau (trùng 100% bộ câu hỏi)**. Đây là mô hình "sinh trước – gán sau", khác với mô hình "random tại thời điểm làm bài" thuần túy → ảnh hưởng trực tiếp đến thuật toán sinh đề và cấu trúc dữ liệu (cần bảng `ExamCode`/`ExamVariant` độc lập với `ExamAttempt`).
2. **Phạm vi MVP:** Ưu tiên tuyệt đối cho **lõi thi** — Quản lý ngân hàng câu hỏi, Sinh đề/mã đề, Làm bài, Chấm điểm. Các module Quản lý kỳ thi (lên lịch, phê duyệt), Kết quả nâng cao, Báo cáo thống kê **vẫn là yêu cầu bắt buộc để hệ thống hoàn chỉnh**, nhưng được xếp sau về thứ tự triển khai, có thể làm ở mức tối giản trong giai đoạn đầu.
3. **Actor/phân quyền:** Người thực hiện đồ án nhận định thực tế sẽ cần **nhiều role hơn** mức tối giản, nhưng hiện chưa đủ thông tin để chốt danh sách role cụ thể. Phần này giữ ở dạng **đề xuất có điều kiện**, sẽ tinh chỉnh dần qua trao đổi.
4. **Quy mô và cấu trúc ngân hàng câu hỏi:** Con số "~100 câu" trong đề bài gốc **chỉ là ví dụ minh họa, không phải số liệu thực tế**. Cấu trúc thực tế (theo ví dụ được nghiệp vụ đưa ra) là:
   - Có các **chủ đề lớn** cấp kỳ thi (vd: "Vệ sinh an toàn lao động").
   - Trong 1 chủ đề lớn, ngân hàng câu hỏi được chia làm 2 loại theo **phạm vi áp dụng (scope)**:
     - **Câu hỏi dùng chung** — áp dụng cho *toàn bộ* thí sinh trong chủ đề đó, không phân biệt bộ phận (thường là câu lý thuyết nền tảng).
     - **Câu hỏi riêng theo bộ phận/chức vụ** — chỉ áp dụng cho thí sinh thuộc bộ phận cụ thể (vd bộ phận Dệt có câu hỏi riêng, bộ phận Vá may mặc có câu hỏi riêng), có thể gồm cả câu lý thuyết lẫn bài tập đặc thù công việc.
   - Như vậy đề thi của 1 thí sinh = **tổ hợp câu hỏi chung (cùng chủ đề) + câu hỏi riêng theo đúng bộ phận/chức vụ của thí sinh đó** → đây là điểm quan trọng ảnh hưởng trực tiếp đến thuật toán sinh mã đề (không random tự do trên toàn bộ ngân hàng của chủ đề, mà phải random có ràng buộc theo 2 nhóm: chung/riêng).
   - **Đã làm rõ (1):** Câu hỏi riêng chỉ chia đến **cấp bộ phận** (không tách sâu hơn theo từng chức vụ trong bộ phận) — mỗi bộ phận có bộ câu hỏi riêng phản ánh đúng công việc bộ phận đó đang làm (vd bộ phận Dệt hỏi về quy trình/an toàn khi dệt, bộ phận Vá may mặc hỏi về quy trình/an toàn khi may).
   - **Đã làm rõ (2):** Tỷ lệ số câu chung : số câu riêng **không cố định theo rule hệ thống, mà do người ra đề quyết định tại thời điểm tạo đề** cho từng kỳ thi. Ví dụ minh họa: 1 mã đề 30 câu thì người ra đề có thể chọn 3–6 câu chung, còn lại là câu riêng theo bộ phận — nhưng đây chỉ là ví dụ, con số thực tế do người ra đề nhập mỗi lần tạo đề, không hard-code. → Hệ thống cần có **input riêng cho "số câu chung" và "số câu riêng"** khi cấu hình sinh đề (ngoài tổng số câu/mã đề), thay vì để cố định trong business rule.
5. **Độ khó câu hỏi:** Được khuyến khích thêm (có người phụ trách nghiệp vụ xác nhận "càng tốt"), nên độ khó **Dễ/Khó** được nâng từ mức "chỉ là ví dụ" lên mức **nên có trong ngân hàng câu hỏi**, dù mức "Trung bình" và cơ chế gán độ khó vẫn còn TBD.
6. **Phê duyệt trước khi công bố:** Đã xác nhận — đề thi/kỳ thi **cần lãnh đạo/cấp trên phê duyệt** trước khi công bố cho thí sinh. → Lãnh đạo chính thức là actor có thao tác trên hệ thống (không chỉ nhận báo cáo ngoài hệ thống), và luồng nghiệp vụ cần trạng thái `Draft → Chờ duyệt → Đã duyệt → Đã công bố`.
7. **Số lần được thi:** Đã xác nhận — **Thi thử: không giới hạn số lần**; **Thi chính thức: chỉ được làm 1 lần duy nhất**.
8. **Gán độ khó và cấu trúc câu hỏi:** Đã xác nhận — **người ra đề tự nhập độ khó ngay khi tạo câu hỏi** (không có bước duyệt riêng), gồm 3 mức: **Dễ / Trung bình / Khó**. Về đáp án, câu hỏi hỗ trợ **2 dạng: chọn 1 đáp án duy nhất (single choice) và chọn nhiều đáp án (multiple choice)**.
9. **Vai trò "người ra đề" / "người tổ chức thi":** Đã xác nhận là **1 role gộp duy nhất** (không tách nhỏ) — người này: tạo/sửa/xóa câu hỏi thuộc chủ đề (phần lớn **import từ file Excel có sẵn**, không nhập tay từng câu), sau đó khi phát đề thì **hệ thống tự động nhặt câu hỏi phù hợp cho từng nhân viên** dựa theo bộ phận của nhân viên đó (nhân viên bộ phận nào thì tự động nhận câu hỏi liên quan tới bộ phận đó, kết hợp với câu hỏi chung của chủ đề). → Import câu hỏi từ Excel được nâng từ "Proposed" lên **Confirmed** (là cách nhập liệu chính, không phải tính năng phụ).
10. **Tài liệu ôn tập:** Đã có định hướng — tài liệu ôn tập là **file văn bản (Word/PDF)** do người ra đề soạn/tải lên, gắn theo chủ đề (và có thể theo bộ phận), phục vụ thí sinh đọc để ôn. Tài liệu này **hoàn toàn tách biệt với ngân hàng câu hỏi** (`Question`) — không chứa sẵn câu hỏi trắc nghiệm kèm đáp án đúng, và đề thi/mã đề **không được trích xuất trực tiếp** từ nội dung file. Mục đích: vừa đảm bảo công bằng (không ai học tủ trúng câu), vừa không lộ đề (file ôn tập không có đáp án trắc nghiệm). Xem chi tiết ở FR-008.

---

## BƯỚC 1 — TÓM TẮT NGHIỆP VỤ

### 1.1. Hiện trạng AS-IS
- Công ty **chưa có hệ thống chuyên biệt** cho thi chuyên môn nghiệp vụ giỏi.
- Đang dùng **Google Forms** để kiểm tra nhân viên.
- Đối tượng dự thi: chủ yếu **nhân viên**, thỉnh thoảng có **công nhân**.
- Ngân hàng câu hỏi được tổ chức theo **chủ đề lớn** (vd: "Vệ sinh an toàn lao động"), trong đó gồm **câu hỏi dùng chung cho toàn bộ thí sinh của chủ đề** và **câu hỏi riêng theo từng bộ phận** (vd bộ phận Dệt, bộ phận Vá may mặc — mỗi bộ phận có cả câu lý thuyết và bài tập đặc thù riêng, phân chia dừng ở cấp bộ phận). Số lượng câu hỏi thực tế lớn hơn nhiều so với con số ví dụ ban đầu, và sẽ mở rộng theo số chủ đề/bộ phận tham gia. Độ khó có 3 mức (**Dễ/Trung bình/Khó**), do người ra đề tự nhập khi tạo câu hỏi.
- Số câu chung/riêng trong mỗi mã đề **do người ra đề tự quyết định** khi tạo đề (không cố định theo rule hệ thống).

### 1.2. Hạn chế thực tế của Google Forms (chỉ nêu những gì có cơ sở, không suy diễn)
Theo đặc tả nghiệp vụ đã có, các hạn chế **được xác nhận có liên quan trực tiếp đến mục tiêu đề tài** là:

| Hạn chế | Vì sao ảnh hưởng đến nghiệp vụ |
|---|---|
| Không hỗ trợ sinh **nhiều mã đề khác nhau, không trùng nhau** cho từng thí sinh một cách có kiểm soát | Đây là yêu cầu công bằng cốt lõi mà đề tài đặt ra |
| Không có cơ chế phân loại câu hỏi theo **nhóm công việc / loại / độ khó** để sinh đề có quy tắc | Ngân hàng câu hỏi cần phân loại nhưng Forms không hỗ trợ ràng buộc sinh đề theo cấu trúc này |
| Không có module quản lý **kỳ thi, lịch thi, danh sách thí sinh, kết quả tập trung** gắn với tổ chức nội bộ | Cần cho việc quản lý đào tạo nội bộ |
| Không có thống kê chuyên sâu theo **nhóm công việc/phòng ban/mức độ câu hỏi sai nhiều** | Phục vụ báo cáo quản lý đào tạo |

*(TBD: các hạn chế khác như giao diện, bảo mật, giới hạn số câu hỏi... chưa được xác nhận là vấn đề thực tế công ty gặp phải — cần hỏi BA nếu muốn đưa vào lý do thay thế.)*

### 1.3. Mục tiêu TO-BE
Xây dựng thử nghiệm một module hỗ trợ:
- Quản lý ngân hàng câu hỏi có phân loại.
- Sinh đề/mã đề tự động, đảm bảo công bằng (không trùng mã đề).
- Tổ chức kỳ thi, lịch ôn/thi.
- Cho thí sinh ôn tập, thi thử, thi chính thức, xem kết quả.
- Thống kê báo cáo phục vụ quản lý đào tạo nội bộ.

### 1.4. Phạm vi hệ thống (Scope)
**Trong phạm vi (định hướng MVP):** Ngân hàng câu hỏi → Sinh đề/mã đề → Làm bài → Chấm điểm → Kết quả cơ bản.
**Mở rộng dần (bắt buộc để hệ thống hoàn chỉnh, nhưng triển khai sau):** Quản lý tài liệu ôn tập, Quản lý kỳ thi/lịch, Báo cáo thống kê nâng cao, Quản trị hệ thống chi tiết.
**Ngoài phạm vi trừ khi được xác nhận:** Tích hợp email/SMS, tích hợp HRM, ứng dụng di động riêng.

---

## BƯỚC 2 — XÁC ĐỊNH ACTOR

| Actor | Vai trò nghiệp vụ | Chức năng dự kiến | Cần xác nhận? |
|---|---|---|---|
| **Người dự thi** (Nhân viên/Công nhân) | Actor nghiệp vụ + Role hệ thống | Xem tài liệu ôn tập, xem lịch thi, làm đề thử, thi chính thức, nộp bài, xem kết quả | Không — đã xác nhận rõ |
| **Người ra đề** (gộp chung, không tách nhỏ — theo xác nhận nghiệp vụ) | Actor nghiệp vụ + Role hệ thống | Import/quản lý câu hỏi (chủ yếu từ Excel), tạo/sửa/xóa câu hỏi và đề, cấu hình sinh mã đề (số câu chung/riêng), tạo kỳ thi, quản lý danh sách thí sinh | Không — đã xác nhận là 1 role gộp |
| **Lãnh đạo** (Giám đốc & cấp liên quan) | Actor nghiệp vụ + Role hệ thống | Quyết định tổ chức kỳ thi, **phê duyệt đề/kỳ thi trước khi công bố** (thao tác trực tiếp trên hệ thống), theo dõi kết quả | Không — đã xác nhận có phê duyệt trên hệ thống |
| **BA / bộ phận nghiệp vụ** | Nguồn cung cấp thông tin nghiệp vụ | Không xác định là actor sử dụng hệ thống | **Có** — mặc định KHÔNG phải role hệ thống cho đến khi được xác nhận ngược lại |
| **Quản trị hệ thống (Admin)** | Actor kỹ thuật | Quản lý tài khoản, phân quyền, cấu hình hệ thống | **Có** — chưa xác nhận là requirement chính thức, hiện đề xuất ở mức tối thiểu cho MVP |

**Ghi chú:** Vai trò "Người ra đề" đã được xác nhận là 1 role gộp (không tách nhỏ) — xem chi tiết ở ghi chú đầu tài liệu, mục 9.

---

## BƯỚC 3 — BUSINESS FLOW (Mức tổng quan)

```
Bộ câu hỏi (import từ Excel là chính)
   → Phân loại (chủ đề / chung-riêng theo bộ phận / lý thuyết-bài tập / độ khó Dễ-TB-Khó — người ra đề tự nhập)
   → Ngân hàng câu hỏi
   → Tạo đề (người ra đề cấu hình: tổng số câu, số câu chung, số câu riêng)
   → Sinh mã đề (hệ thống tự động, nhiều mã đề không trùng nhau, đủ cho số thí sinh, tự "nhặt" câu riêng theo đúng bộ phận từng thí sinh)
   → Trình lãnh đạo phê duyệt
   → Lãnh đạo phê duyệt đề/kỳ thi
   → Tạo kỳ thi (nếu chưa tạo trước đó)
   → Lên lịch
   → Thông báo [TBD: hình thức thông báo]
   → Ôn tập
   → Thi thử (không giới hạn số lần)
   → Thi chính thức (chỉ 1 lần duy nhất)
   → Chấm điểm
   → Kết quả
   → Báo cáo
```

*Không thêm bước ngoài luồng đã được xác nhận trong đề bài gốc.*

---

## BƯỚC 4 — XÁC ĐỊNH USE CASE (theo nhóm)

**1. Quản lý câu hỏi:** Thêm/Sửa/Xóa câu hỏi, Phân loại câu hỏi, Quản lý đáp án, Tìm kiếm/lọc câu hỏi, Import câu hỏi từ Excel *(Proposed)*.

**2. Quản lý tài liệu:** Tải lên/quản lý tài liệu ôn tập (file Word/PDF, gắn theo chủ đề và có thể theo bộ phận), Xem/tải tài liệu. Tài liệu tách biệt hoàn toàn với ngân hàng câu hỏi, không dùng để sinh đề *(xem FR-008; TBD chi tiết quyền)*.

**3. Quản lý đề:** Sinh đề tự động, Sinh mã đề (nhiều bộ, không trùng), Cấu hình quy tắc sinh đề, Xem/quản lý danh sách mã đề.

**4. Quản lý kỳ thi:** Tạo kỳ thi, Chọn đối tượng tham gia, Thiết lập thời gian/thời lượng/số câu, Gán mã đề cho thí sinh, Công bố kỳ thi.

**5. Làm bài:** Xem đề, Chọn đáp án, Điều hướng câu hỏi, Đếm ngược thời gian, Nộp bài (thủ công/tự động khi hết giờ).

**6. Kết quả:** Xem điểm, Xem đúng/sai, Đạt/không đạt, Lịch sử làm bài.

**7. Báo cáo:** Thống kê theo kỳ thi/nhóm công việc, Câu hỏi sai nhiều, Xuất báo cáo *(Proposed, chưa xác nhận là bắt buộc)*.

**8. Quản trị:** Quản lý tài khoản, Phân quyền *(TBD mức độ chi tiết)*.

---

## BƯỚC 5 — FUNCTIONAL REQUIREMENTS (trích các FR quan trọng nhất cho MVP)

### FR-001: Quản lý câu hỏi trong ngân hàng (theo chủ đề lớn, có câu chung và câu riêng theo bộ phận)
- **Actor:** Người ra đề
- **Input:** Nội dung câu hỏi, **chủ đề lớn** (vd "Vệ sinh an toàn lao động"), **phạm vi áp dụng — Chung (toàn bộ chủ đề) hoặc Riêng (gắn với 1 bộ phận cụ thể)**, loại (lý thuyết/bài tập), **độ khó (Dễ/Trung bình/Khó — tự nhập khi tạo câu hỏi)**, **dạng đáp án (chọn 1 đáp án duy nhất / chọn nhiều đáp án)**, các phương án trả lời, đáp án đúng
- **Process:** Thêm/sửa/xóa (hoặc ngừng sử dụng) câu hỏi — **chủ yếu qua import từ file Excel có sẵn**, có thể nhập tay bổ sung; validate đủ trường bắt buộc; nếu chọn phạm vi "Riêng" thì bắt buộc gán bộ phận tương ứng
- **Output:** Câu hỏi được lưu vào ngân hàng theo đúng chủ đề và phạm vi áp dụng, sẵn sàng cho việc sinh đề
- **Business Rule:** Một câu hỏi thuộc đúng 1 chủ đề lớn; nếu phạm vi là "Riêng" thì phải gắn đúng 1 bộ phận; loại và độ khó là bắt buộc, người ra đề tự nhập, không có bước duyệt riêng; dạng đáp án bắt buộc chọn 1 trong 2 (single/multiple choice)
- **Acceptance Criteria:** Câu hỏi mới tạo (kể cả qua import Excel) xuất hiện trong danh sách tìm kiếm/lọc theo chủ đề, phạm vi (chung/riêng), bộ phận, loại, độ khó, dạng đáp án
- **Trạng thái:** Confirmed (mô hình chủ đề lớn + chung/riêng theo bộ phận, chia đến cấp bộ phận, độ khó 3 mức tự nhập, 2 dạng đáp án, import Excel là cách nhập chính)

### FR-002: Sinh mã đề tự động (không trùng nhau)
- **Actor:** Người ra đề / Hệ thống
- **Input:** Số lượng câu hỏi mỗi mã đề (N, cấu hình được — vd 30/40/50), **số câu chung và số câu riêng theo bộ phận trong N câu đó (do người ra đề nhập tại thời điểm tạo đề, ví dụ 30 câu thì 3–6 câu chung, còn lại là câu riêng)**, số lượng mã đề cần sinh (≥ số thí sinh dự thi)
- **Process:** Hệ thống chọn ngẫu nhiên N câu từ ngân hàng để tạo từng mã đề; kiểm tra và đảm bảo không có 2 mã đề trùng 100% bộ câu hỏi; lặp lại cho đến khi đủ số mã đề yêu cầu
- **Output:** Danh sách các mã đề (`ExamCode`), mỗi mã đề gắn với danh sách câu hỏi cụ thể
- **Business Rule:**
  - Không có 2 mã đề giống hệt nhau (100% trùng bộ câu hỏi).
  - Số mã đề sinh ra phải ≥ số thí sinh dự thi.
  - **TBD:** Có cho phép trùng một phần (vd trùng 50%) giữa 2 mã đề không, hay cần giới hạn tỷ lệ trùng tối đa?
  - **TBD:** Có bắt buộc tỷ lệ câu theo loại/độ khó trong mỗi mã đề không, hay random hoàn toàn?
  - **TBD:** Có đảo thứ tự câu hỏi và đáp án giữa các mã đề không?
  - **Mới bổ sung:** Do ngân hàng câu hỏi trong 1 chủ đề gồm cả **câu hỏi dùng chung** và **câu hỏi riêng theo bộ phận**, mỗi mã đề của 1 thí sinh phải là tổ hợp: **một phần câu chung (lấy chung cho cả chủ đề) + một phần câu riêng đúng theo bộ phận của thí sinh đó**. Thuật toán sinh đề vì vậy cần random có ràng buộc theo 2 nhóm (chung/riêng); **số câu mỗi nhóm do người ra đề tự nhập khi tạo đề** (đã xác nhận — xem ghi chú đầu tài liệu, mục 6).
- **Acceptance Criteria:** Với X thí sinh, hệ thống sinh ra ≥ X mã đề hợp lệ, không có cặp mã đề nào trùng 100%
- **Trạng thái:** Confirmed (mô hình sinh trước – gán sau, theo định hướng đã chọn), TBD (các ràng buộc phân bổ chi tiết)

### FR-003: Gán mã đề cho thí sinh
- **Actor:** Hệ thống / Người ra đề
- **Input:** Danh sách thí sinh dự thi, danh sách mã đề đã sinh
- **Process:** Gán ngẫu nhiên 1 mã đề duy nhất cho mỗi thí sinh, đảm bảo không thí sinh nào không có mã đề
- **Output:** Bảng ánh xạ Thí sinh — Mã đề
- **Business Rule:** Mỗi thí sinh chỉ nhận đúng 1 mã đề cho 1 lượt thi
- **Trạng thái:** Confirmed (theo định hướng), TBD (có cho phép 2 thí sinh cùng phòng nhận mã đề giống nhau không — hiện giả định KHÔNG, do rule "không trùng nhau" ở FR-002)

### FR-004: Làm bài thi
- **Actor:** Người dự thi
- **Input:** Mã đề đã gán, thời gian làm bài
- **Process:** Hiển thị câu hỏi theo mã đề, cho phép chọn đáp án, điều hướng qua lại giữa các câu, đếm ngược thời gian, tự động nộp khi hết giờ
- **Output:** Bài làm được lưu (`CandidateAnswer`)
- **Business Rule:** Không được chỉnh sửa bài sau khi nộp; tự động nộp khi hết thời gian **(TBD: có bắt buộc không, hay chỉ cảnh báo?)**
- **Trạng thái:** Confirmed (luồng cơ bản), TBD (chi tiết tự nộp, có cho làm lại không)

### FR-005: Chấm điểm và kết quả
- **Actor:** Hệ thống
- **Input:** Bài làm của thí sinh, đáp án đúng trong ngân hàng
- **Process:** So khớp đáp án, tính điểm, xác định đạt/không đạt theo ngưỡng
- **Output:** Điểm số, số câu đúng/sai, trạng thái đạt/không đạt
- **Business Rule:** **TBD:** Ngưỡng đạt là bao nhiêu điểm/% ? Có tính điểm theo trọng số độ khó không?
- **Trạng thái:** TBD (thiếu ngưỡng đạt — đây là thông tin bắt buộc phải hỏi BA trước khi code phần chấm điểm)

### FR-006: Phê duyệt đề/kỳ thi trước khi công bố
- **Actor:** Lãnh đạo
- **Input:** Đề/kỳ thi ở trạng thái "Chờ duyệt" do Người ra đề gửi lên
- **Process:** Lãnh đạo xem lại nội dung đề/kỳ thi, phê duyệt hoặc từ chối (yêu cầu chỉnh sửa)
- **Output:** Trạng thái đề/kỳ thi chuyển thành "Đã duyệt" (sẵn sàng công bố) hoặc quay lại "Nháp" nếu bị từ chối
- **Business Rule:** Đề/kỳ thi **không được công bố cho thí sinh nếu chưa được lãnh đạo phê duyệt**
- **Acceptance Criteria:** Thí sinh không thể nhìn thấy/thi 1 kỳ thi chưa ở trạng thái "Đã duyệt và công bố"
- **Trạng thái:** Confirmed

### FR-007: Giới hạn số lần thi
- **Actor:** Người dự thi / Hệ thống
- **Input:** Loại lượt thi (thi thử hoặc thi chính thức), lịch sử các lượt đã làm của thí sinh
- **Process:** Với thi thử — cho phép làm không giới hạn số lần; với thi chính thức — kiểm tra thí sinh đã có lượt `ExamAttempt` hoàn thành cho kỳ thi đó chưa, nếu có rồi thì chặn không cho làm lại
- **Output:** Cho phép hoặc chặn việc bắt đầu lượt thi mới
- **Business Rule:** Thi thử — không giới hạn số lần; Thi chính thức — chỉ đúng 1 lần cho mỗi kỳ thi
- **Acceptance Criteria:** Thí sinh đã nộp bài thi chính thức không thể bắt đầu lượt thi chính thức thứ 2 cho cùng kỳ thi đó
- **Trạng thái:** Confirmed (TBD: có ngoại lệ nào cho phép thi lại chính thức không — vd do lỗi kỹ thuật, mất kết nối giữa chừng — cần hỏi thêm nếu muốn xử lý trường hợp này)

### FR-008: Quản lý và xem tài liệu ôn tập
- **Actor:** Người ra đề (quản lý), Người dự thi (xem/tải)
- **Input:** File tài liệu (Word/PDF), chủ đề lớn (`Topic`) mà tài liệu thuộc về, phạm vi áp dụng (Chung cho cả chủ đề / Riêng theo bộ phận — tùy chọn)
- **Process:**
  - Người ra đề tải lên file Word/PDF, gán vào 1 `Topic`, có thể gán thêm `Department` nếu là tài liệu riêng cho bộ phận.
  - Người dự thi xem danh sách tài liệu theo chủ đề (và theo bộ phận của mình, nếu có), xem/tải file để ôn tập.
- **Output:** Tài liệu được lưu và hiển thị cho đúng đối tượng thí sinh liên quan.
- **Business Rule:**
  - Tài liệu ôn tập là **nội dung lý thuyết/quy trình dạng văn bản**, hoàn toàn **tách biệt với ngân hàng câu hỏi** (`Question`) — không chứa sẵn câu hỏi trắc nghiệm kèm đáp án đúng.
  - Đề thi (sinh mã đề — FR-002) **không được trích xuất trực tiếp** từ nội dung file tài liệu; câu hỏi thi vẫn lấy từ `Question` do người ra đề nhập/import riêng.
  - Mục đích: đảm bảo công bằng (không ai học tủ trúng câu) và không lộ đề (file ôn tập không có đáp án trắc nghiệm).
- **Acceptance Criteria:** Thí sinh chỉ xem được tài liệu thuộc chủ đề mình sắp thi (và đúng bộ phận nếu tài liệu là riêng); không có đường dẫn nào để xem trước câu hỏi/đáp án của mã đề từ màn hình tài liệu ôn tập.
- **Trạng thái:** Assumption của nhóm nghiên cứu (dựa trên quyết định thiết kế của người thực hiện đồ án, chưa xác nhận chính thức từ BA) — cần đối chiếu lại khi khảo sát thực tế.

*(Các FR còn lại — quản lý lịch/thông báo, báo cáo thống kê, quản trị chi tiết — sẽ được viết chi tiết ở phiên bản sau khi các mục TBD tương ứng được làm rõ, để tránh thiết kế sai sớm.)*

---

## BƯỚC 6 — BUSINESS RULES (tổng hợp)

| Chủ đề | Rule đã xác nhận / định hướng | Còn TBD |
|---|---|---|
| Ngân hàng câu hỏi | Tổ chức theo **chủ đề lớn** (vd "Vệ sinh an toàn lao động"), gồm **câu hỏi dùng chung** cho cả chủ đề và **câu hỏi riêng theo bộ phận** (cả lý thuyết lẫn bài tập, phản ánh đúng công việc bộ phận đó làm); phân chia riêng dừng ở **cấp bộ phận**; độ khó **3 mức (Dễ/Trung bình/Khó)**, người ra đề tự nhập; đáp án có 2 dạng (chọn 1 / chọn nhiều); nhập liệu chủ yếu qua **import Excel** | Không còn TBD lớn ở mục này |
| Số câu/mã đề | Có thể cấu hình 30/40/50 câu mỗi mã đề; **số câu chung và số câu riêng do người ra đề tự nhập** khi tạo đề (không cố định) | Có cần validate giới hạn hợp lý khi người ra đề nhập số câu chung/riêng không? |
| Phê duyệt | Đề/kỳ thi **bắt buộc lãnh đạo phê duyệt** trước khi công bố | Quy trình từ chối/yêu cầu sửa lại cụ thể như thế nào? |
| Số lần thi | Thi thử: không giới hạn; Thi chính thức: chỉ 1 lần | Có ngoại lệ cho thi lại chính thức khi có sự cố kỹ thuật không? |
| Sinh mã đề | Sinh trước nhiều mã đề, số lượng ≥ số thí sinh, không mã đề nào trùng 100% | Có giới hạn tỷ lệ trùng một phần không? Có ràng buộc tỷ lệ theo nhóm/loại/độ khó không? |
| Công bằng | Mỗi thí sinh 1 mã đề riêng, không trùng nhau hoàn toàn | Có đảo thứ tự câu/đáp án giữa các mã đề không? |
| Thời gian thi | Có đếm ngược, tự động nộp khi hết giờ | Thời lượng cụ thể? Bắt buộc tự nộp hay chỉ cảnh báo? |
| Số lần thi | Chưa có thông tin | Thí sinh được thi lại không? Thi thử có giới hạn số lần không? |
| Chấm điểm / Đạt-không đạt | Chấm tự động theo đáp án đúng | Ngưỡng đạt là bao nhiêu? Có trọng số theo độ khó không? |

---

## BƯỚC 7 — NHỮNG ĐIỂM CÒN THIẾU (cần hỏi BA)

| STT | Nội dung cần xác nhận | Tại sao quan trọng | Câu hỏi cần hỏi BA |
|---|---|---|---|
| 1 | Ngưỡng đạt/không đạt | Bắt buộc phải có để code module chấm điểm | "Bao nhiêu điểm hoặc bao nhiêu % câu đúng thì được coi là đạt?" |
| 2 | Hình thức thông báo lịch thi cho thí sinh | Ảnh hưởng phạm vi tích hợp (email/nội bộ/chỉ hiển thị trong hệ thống) | "Thí sinh nhận thông báo lịch thi qua đâu — email, hệ thống nội bộ, hay chỉ xem trực tiếp khi đăng nhập?" |
| 3 | Khi hết thời gian làm bài, hệ thống có bắt buộc tự nộp không | Ảnh hưởng UX và logic xử lý khi mất kết nối | "Khi hết thời gian làm bài, hệ thống có bắt buộc tự nộp không, hay chỉ cảnh báo và chờ thí sinh tự nộp?" |
| 4 | Có cần đặt giới hạn tối thiểu/tối đa cho số câu chung khi người ra đề tự nhập không | Tránh trường hợp bất hợp lý (vd 0 câu riêng) làm mất ý nghĩa đề thi | "Khi người ra đề tự chọn số câu chung/riêng, hệ thống có cần chặn các trường hợp bất hợp lý không, hay để người ra đề tự chịu trách nhiệm?" |
| 5 | Quy trình khi lãnh đạo từ chối phê duyệt | Ảnh hưởng thiết kế trạng thái đề/kỳ thi và use case "Yêu cầu chỉnh sửa" | "Khi lãnh đạo từ chối phê duyệt, đề/kỳ thi có quay lại trạng thái nháp để sửa không, và người ra đề có nhận thông báo lý do từ chối không?" |
| 6 | Ngoại lệ cho thi lại thi chính thức (do lỗi kỹ thuật, mất kết nối) | Ảnh hưởng độ phức tạp của FR-007 và có cần cơ chế "reset lượt thi" hay không | "Nếu thí sinh gặp sự cố kỹ thuật giữa lúc thi chính thức, có cơ chế nào cho thi lại không, và ai có quyền cấp phép việc đó?" |
| 7 | Danh sách người được thi lấy từ đâu | Ảnh hưởng thiết kế module quản lý danh sách thí sinh — tích hợp danh sách nhân sự có sẵn hay nhập thủ công | "Danh sách nhân viên/công nhân được thi có lấy từ hệ thống nhân sự có sẵn không, hay người ra đề tự nhập/chọn thủ công?" |

---

## BƯỚC 8 — ĐỀ XUẤT MVP

### Must Have (bắt buộc cho bản thử nghiệm/đồ án)
- Quản lý ngân hàng câu hỏi (thêm/sửa/xóa, phân loại nhóm/loại/độ khó)
- Sinh mã đề tự động, đảm bảo không trùng nhau, đủ số lượng cho thí sinh
- Gán mã đề cho thí sinh
- Làm bài thi (hiển thị câu hỏi theo mã đề, chọn đáp án, đếm giờ, nộp bài)
- Chấm điểm tự động và hiển thị kết quả cơ bản (điểm, đúng/sai, đạt/không đạt)
- Quản lý tài khoản/đăng nhập ở mức tối thiểu (2-3 role)

### Should Have (cần có để hệ thống hoàn chỉnh, làm sau)
- Quản lý kỳ thi (tạo kỳ thi, chọn đối tượng, thời gian, công bố)
- Lịch ôn/thi và thông báo cơ bản trong hệ thống
- Đề thi thử riêng biệt với thi chính thức
- Lịch sử làm bài của thí sinh

### Could Have (mở rộng nếu còn thời gian)
- Quản lý tài liệu ôn tập
- Báo cáo thống kê nâng cao (phân bố điểm, câu hỏi sai nhiều, xu hướng qua các kỳ thi)
- Import câu hỏi từ Excel
- Xuất báo cáo Excel/PDF
- Phân quyền chi tiết theo nhiều role tổ chức thi
- Phê duyệt đề/kỳ thi nhiều cấp

---

## BƯỚC 9 — ĐỀ XUẤT MÔ HÌNH DỮ LIỆU SƠ BỘ (chỉ ở mức khái niệm, chưa thiết kế chi tiết vì còn nhiều TBD)

**Entity chính (điều chỉnh theo định hướng đã chọn):**

- `User` (tài khoản đăng nhập)
- `Role` (Người dự thi / Người ra đề / Lãnh đạo / Admin — tạm thời, có thể tách thêm)
- `Employee` (nhân viên/công nhân — liên kết với User)
- `Department` (bộ phận, vd Dệt, Vá may mặc — gắn với câu hỏi "riêng"; đây là cấp phân chia sâu nhất, không tách theo chức vụ)
- `Topic` (chủ đề lớn cấp kỳ thi, vd "Vệ sinh an toàn lao động")
- `Question` (nội dung, loại lý thuyết/bài tập, độ khó, thuộc 1 `Topic`; có trường **scope**: `Common` hoặc `DepartmentSpecific`; nếu `DepartmentSpecific` thì liên kết thêm tới `Department`)
- `Answer` (các phương án trả lời của Question, đánh dấu đáp án đúng)
- `ExamCode` (mã đề — danh sách câu hỏi cụ thể, sinh trước)
- `ExamCodeQuestion` (bảng liên kết ExamCode — Question)
- `Exam` (kỳ thi: thời gian, thời lượng, số câu, trạng thái)
- `ExamCandidate` (thí sinh dự thi trong 1 kỳ thi, gắn với 1 ExamCode)
- `ExamAttempt` (lượt làm bài thực tế của thí sinh)
- `CandidateAnswer` (câu trả lời của thí sinh trong 1 lượt làm bài)
- `Result` (điểm số, đạt/không đạt — có thể tính toán từ ExamAttempt thay vì lưu riêng)
- `Document` — tài liệu ôn tập dạng file Word/PDF, gắn với 1 `Topic`, có thể gắn thêm `Department` nếu là tài liệu riêng; **tách biệt hoàn toàn với `Question`**, không dùng để sinh đề *(cho module tài liệu ôn tập — Should/Could Have, xem FR-008)*
- `Schedule` *(cho module lịch thi — Should Have)*

**Lưu ý:** Chưa thiết kế khóa, ràng buộc, kiểu dữ liệu chi tiết — sẽ thực hiện ở bước ERD sau khi các FR còn TBD (đặc biệt FR-002, FR-005) được chốt.

---

## BƯỚC 10 — ĐỀ XUẤT KIẾN TRÚC CHỨC NĂNG (mức tổng thể)

```
Người dùng (Người dự thi / Người ra đề / Lãnh đạo / Admin)
        │
        ▼
Authentication / Authorization
        │
        ├──▶ Question Bank Module        (Must Have)
        ├──▶ Exam Generation Module      (Must Have — sinh mã đề)
        ├──▶ Examination Module          (Must Have — làm bài, chấm điểm)
        ├──▶ Exam Management Module      (Should Have — kỳ thi, lịch)
        ├──▶ Document Module             (Could Have)
        ├──▶ Result Module               (Must/Should Have)
        └──▶ Statistics / Reports Module (Could Have)
```

---

## GHI CHÚ CUỐI TÀI LIỆU

Tài liệu này là **bản nháp v1.0**, được xây dựng dựa trên thông tin đã có và các định hướng tạm thời do người thực hiện đồ án lựa chọn (mục "Ghi chú về các quyết định đã chốt tạm" ở đầu tài liệu). Trước khi chuyển sang giai đoạn Use Case chi tiết / ERD / API, nên:

1. Rà lại **Bước 7 (10 câu hỏi cần hỏi BA)** — đây là các điểm ảnh hưởng trực tiếp đến thuật toán và kiến trúc.
2. Nếu không thể khảo sát BA thật (do đây là môi trường học thuật/thử nghiệm), có thể **tự đưa ra giả định hợp lý và ghi rõ là "Assumption của nhóm nghiên cứu"** thay vì "Confirmed", để giữ tính minh bạch trong báo cáo đồ án.
