# Design System — Phiên bản Hiện đại & Công nghệ Đổi mới

## 1. Tinh thần thiết kế & Cảm xúc thị giác

Phiên bản này giữ lại màu xanh dương đặc trưng (`#008BC5`) làm gốc nhận diện — vẫn mang tính tin cậy, chuyên nghiệp — nhưng được "làm mới" theo hướng công nghệ, năng động và tối giản hơn. Thay vì các khối vuông sắc cạnh (0px radius), hệ thống mới dùng bo góc mềm (8–16px) để tạo cảm giác thân thiện, hiện đại. Một màu nhấn cyan công nghệ (`#00D9C0`) được thêm vào để tạo điểm nhấn "đổi mới, bứt phá" trên các chi tiết quan trọng (nút CTA nổi bật, trạng thái active, biểu đồ, icon công nghệ). Độ sâu (shadow) được sử dụng nhiều hơn nhưng vẫn mềm, tạo cảm giác "nổi" nhẹ nhàng, không nặng nề. Bố cục ưu tiên khoảng trắng lớn, nội dung được nhóm rõ ràng, giảm chi tiết thừa để tổng thể trông "sạch, gọn, dễ nhìn".

**Đặc điểm chính**
- Giữ xanh dương chủ đạo (`#008BC5`) nhưng thêm gradient nhẹ để tạo chiều sâu
- Thêm màu nhấn cyan công nghệ (`#00D9C0`) cho các điểm "đổi mới"
- Bo góc mềm (8–16px) thay cho góc vuông — cảm giác thân thiện, hiện đại
- Shadow mềm, nhiều lớp độ sâu tinh tế thay vì flat hoàn toàn
- Typography rõ ràng, khoảng cách chữ thoáng, ưu tiên trọng số nhẹ cho tiêu đề lớn
- Bố cục thoáng, nhóm nội dung theo card bo góc, có khoảng trắng lớn giữa các section
- Dark mode friendly: hệ màu trung tính được thiết kế để hoạt động tốt trên nền sáng và tối

## 2. Bảng màu & Vai trò

### Màu chính (Primary)
- **Xanh chính** (`#008BC5`): CTA chính, trạng thái active, thương hiệu
- **Xanh Gradient Start** (`#0EA5E9`): Điểm bắt đầu gradient cho hero, banner công nghệ
- **Xanh Gradient End** (`#005A87`): Điểm kết gradient, tạo chiều sâu
- **Xanh Hover** (`#0693E3`): Hover cho nút và link chính
- **Xanh Active** (`#006BA1`): Trạng thái nhấn/pressed

### Màu nhấn công nghệ (Accent — Đổi mới)
- **Cyan Công nghệ** (`#00D9C0`): Điểm nhấn "đổi mới" — badge mới, icon công nghệ, số liệu nổi bật, đường viền active đặc biệt
- **Cyan Đậm** (`#00B39E`): Hover/active cho các phần tử cyan
- **Tím Điện** (`#7C5CFC`): Accent phụ cho tính năng nổi bật, tag "AI/Innovation"
- **Cam Năng lượng** (`#FF7A00`): Cảnh báo nhẹ, badge khuyến khích hành động

### Trạng thái (Semantic)
- **Đỏ Lỗi** (`#E53E3E`): Lỗi, xóa, cảnh báo nghiêm trọng
- **Đỏ Đậm** (`#C53030`): Hover/active cho trạng thái lỗi
- **Vàng Cảnh báo** (`#F6AD37`): Cảnh báo nhẹ, thông báo cần chú ý
- **Xanh Lá Thành công** (`#22C55E`): Thành công, hoàn tất, trạng thái tích cực

### Nền & Trung tính
- **Nền Trắng** (`#FFFFFF`): Nền chính, card sáng
- **Nền Xám Nhạt** (`#F6F8FA`): Nền phụ, phân vùng section
- **Nền Tối** (`#0B1220`): Nền cho section công nghệ/hero tối, dark mode
- **Chữ Đen** (`#0F172A`): Heading, chữ chính
- **Chữ Xám Đậm** (`#334155`): Body text chính
- **Chữ Xám** (`#64748B`): Text phụ, chú thích
- **Chữ Xám Nhạt** (`#94A3B8`): Placeholder, disabled
- **Viền Nhạt** (`#E2E8F0`): Viền input, chia section nhẹ

## 3. Typography

### Font chữ
**Font chính:** Inter (Google Fonts) — giữ nguyên vì đã tối ưu cho UI hiện đại
- Stack: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`

### Hệ thống cấp độ

| Vai trò | Size | Weight | Line Height | Ghi chú |
|---|---|---|---|---|
| Display / H1 | 40px | 700 | 48px | Hero, tiêu đề trang lớn — đậm hơn bản cũ để tạo điểm nhấn |
| H2 | 28px | 700 | 36px | Tiêu đề section |
| H3 | 20px | 600 | 28px | Tiêu đề card, mục con |
| Body Lớn | 16px | 400 | 26px | Mô tả chính, đoạn mở đầu |
| Body Chuẩn | 15px | 400 | 24px | Nội dung chính |
| Body Nhấn | 15px | 600 | 24px | Nội dung cần nhấn mạnh |
| Caption | 13px | 500 | 18px | Label, chú thích, form helper |
| Button | 15px | 600 | 20px | Chữ trong nút |
| Link | 15px | 500 | 24px | Underline khi hover |

### Nguyên tắc
- Tiêu đề lớn (H1) dùng weight đậm (700) khác với bản cũ (300) — tạo cảm giác tự tin, hiện đại hơn là "trang trọng, cổ điển"
- Body text tối thiểu 15px để dễ đọc trên nhiều thiết bị
- Line-height rộng (1.5–1.6x) cho cảm giác thoáng, dễ chịu
- Chỉ dùng 2 cấp weight cho mỗi trang: 400 (nội dung) và 600–700 (nhấn) để tránh rối

## 4. Thành phần (Components)

### Nút bấm (Buttons)

#### Nút chính (Primary)
- **Nền:** gradient `linear-gradient(135deg, #0EA5E9, #008BC5)`
- **Chữ:** `#FFFFFF`, 15px, weight 600
- **Padding:** `12px 28px`
- **Border radius:** `12px`
- **Shadow:** `0px 4px 12px rgba(0, 139, 197, 0.25)`
- **Hover:** nâng shadow `0px 6px 16px rgba(0, 139, 197, 0.35)`, dịch nhẹ lên `-1px`
- **Active:** nền `#006BA1`, shadow giảm
- **Disabled:** opacity `0.4`, không shadow

#### Nút phụ (Secondary)
- **Nền:** `#FFFFFF`
- **Chữ:** `#008BC5`
- **Viền:** `1.5px solid #008BC5`
- **Border radius:** `12px`
- **Hover:** nền `#F0F9FF`, viền `#0693E3`

#### Nút Đổi mới (Innovation CTA — mới)
- **Nền:** `#00D9C0`
- **Chữ:** `#0B1220`
- **Border radius:** `12px`
- **Dùng cho:** tính năng mới, AI, sản phẩm công nghệ nổi bật
- **Hover:** nền `#00B39E`, chữ `#FFFFFF`

#### Nút Ghost
- **Nền:** transparent
- **Chữ:** `#008BC5`
- **Border radius:** `10px`
- **Hover:** nền `rgba(0, 139, 197, 0.08)`

### Thẻ (Cards)

#### Card chuẩn
- **Nền:** `#FFFFFF`
- **Border radius:** `16px`
- **Padding:** `24px`
- **Shadow:** `0px 2px 8px rgba(15, 23, 42, 0.06)`
- **Viền:** `1px solid #E2E8F0` (tùy chọn, mềm)

#### Card nổi (Elevated / Hover)
- **Shadow:** `0px 8px 24px rgba(15, 23, 42, 0.12)`
- **Hover:** nâng nhẹ `translateY(-2px)`, shadow tăng
- **Dùng cho:** feature card, sản phẩm nổi bật

#### Card công nghệ (Tech/Innovation Card)
- **Nền:** gradient tối `linear-gradient(135deg, #0B1220, #1E293B)`
- **Chữ:** `#FFFFFF`
- **Viền nhấn:** `1px solid rgba(0, 217, 192, 0.3)`
- **Border radius:** `16px`
- **Dùng cho:** khối giới thiệu công nghệ, AI, số liệu nổi bật

### Form & Input

#### Text Input
- **Nền:** `#FFFFFF`
- **Viền:** `1.5px solid #E2E8F0`
- **Border radius:** `10px`
- **Padding:** `12px 16px`
- **Chiều cao:** `44px`
- **Focus:** viền `#008BC5`, shadow `0px 0px 0px 3px rgba(0, 139, 197, 0.15)`
- **Lỗi:** viền `#E53E3E`, shadow đỏ nhạt tương ứng
- **Disabled:** nền `#F6F8FA`, chữ `#94A3B8`

#### Label
- **Size:** 13px, weight 600, màu `#334155`, margin-bottom `6px`

### Điều hướng (Navigation)

#### Navbar
- **Nền:** `#FFFFFF` với shadow rất nhẹ khi scroll `0px 1px 0px #E2E8F0`
- **Chiều cao:** `72px`
- **Padding ngang:** `48px` (desktop), `20px` (mobile)
- **Link:** `#334155`, hover/active `#008BC5`
- **Active indicator:** thanh nhỏ bo tròn `4px` màu `#00D9C0` phía dưới link (thay cho gạch vuông cứng)

#### Nút CTA trong Navbar
- **Nền:** gradient primary
- **Border radius:** `24px` (pill), giữ phong cách bo tròn hoàn toàn cho CTA nổi bật

### Badge

- **Badge Mặc định:** nền `#EAF6FF`, chữ `#008BC5`, border radius `999px` (pill), padding `4px 12px`
- **Badge Đổi mới/Mới:** nền `#00D9C0`, chữ `#0B1220`, pill, dùng cho "Mới", "AI", "Beta"
- **Badge Cảnh báo:** nền `#FFF7E6`, chữ `#B45309`
- **Badge Lỗi:** nền `#FEECEC`, chữ `#C53030`

## 5. Bố cục (Layout)

### Hệ khoảng cách (Spacing)
Đơn vị gốc `4px`, giữ cấu trúc tương tự bản cũ nhưng áp dụng linh hoạt hơn với bo góc:

- XS: 4px · S: 8px · M: 12px · L: 16px · XL: 24px · 2XL: 32px · 3XL: 48px · 4XL: 64px · 5XL: 96px

### Lưới & Container
- **Max width:** `1280px` (thu hẹp hơn bản cũ để nội dung tập trung, hiện đại hơn)
- **Padding ngang chuẩn:** `48px` desktop, `20px` mobile
- **Gutter:** `24px`
- **Column:** lưới 12 cột, ưu tiên bố cục bất đối xứng nhẹ (ví dụ 7/5, 8/4) cho cảm giác năng động hơn lưới đối xứng truyền thống

### Border Radius
- **Nhỏ:** `8px` — badge nhỏ, input
- **Chuẩn:** `12px` — nút, card nhỏ
- **Lớn:** `16px` — card, panel
- **Pill:** `999px` — CTA nổi bật, badge

## 6. Độ sâu & Hiệu ứng (Elevation)

| Cấp | Shadow | Dùng cho |
|---|---|---|
| Level 0 | none | Nền, section phẳng |
| Level 1 | `0px 2px 8px rgba(15,23,42,0.06)` | Card chuẩn |
| Level 2 | `0px 8px 24px rgba(15,23,42,0.12)` | Card hover, dropdown |
| Level 3 | `0px 16px 40px rgba(15,23,42,0.18)` | Modal, overlay |

**Nguyên tắc:** Khác với bản cũ (gần như flat), phiên bản mới dùng shadow nhiều lớp hơn nhưng luôn mềm (blur lớn, opacity thấp) để tạo cảm giác "nổi nhẹ", không nặng — đúng chất công nghệ hiện đại (kiểu Notion/Linear/Stripe).

## 7. Nên & Không nên

### Nên
- Dùng gradient xanh cho các khối hero/CTA lớn để tạo cảm giác công nghệ, chuyển động
- Dùng màu cyan (`#00D9C0`) như "dấu hiệu đổi mới" — chỉ áp cho tính năng mới, không lạm dụng
- Bo góc nhất quán theo thang 8/12/16/999px
- Dùng shadow mềm để tạo chiều sâu, tránh viền cứng khi không cần thiết
- Ưu tiên khoảng trắng lớn giữa các section (64–96px)

### Không nên
- Không dùng quá 2 màu accent (cyan + tím) trong cùng một màn hình
- Không trộn bo góc vuông (0px) với bo góc mềm trong cùng hệ thống
- Không dùng shadow đậm/cứng — luôn giữ blur lớn, opacity thấp
- Không để chữ dưới 13px trừ caption
- Không dùng gradient cho văn bản hoặc nền chứa nhiều chữ dài (giảm khả năng đọc)

## 8. Responsive

| Breakpoint | Độ rộng | Thay đổi chính |
|---|---|---|
| Mobile | `< 640px` | 1 cột, padding 20px, nút full-width, navbar rút gọn |
| Tablet | `640–1024px` | 2 cột, padding 32px |
| Desktop | `1024–1280px` | Lưới 12 cột đầy đủ, padding 48px |
| Large | `> 1280px` | Container cố định 1280px, căn giữa |

## 9. Thành phần riêng cho Hệ thống Thi Trắc nghiệm

Áp dụng đúng bảng màu/typography ở trên, nhưng **tiết chế gradient và hiệu ứng nổi** để giữ cảm giác nghiêm túc, đáng tin cậy — phù hợp môi trường thi/đánh giá của doanh nghiệp. Nguyên tắc: rõ ràng > trang trí; trạng thái (đã làm/chưa làm/đúng/sai) phải nhận biết ngay bằng màu, không cần đọc chữ.

### Thanh tiến trình bài thi (Exam Progress Bar)
- **Nền track:** `#E2E8F0`, border radius `999px`, cao `8px`
- **Fill:** `#008BC5` (flat, không gradient — giữ cảm giác chuẩn mực)
- **Label kèm:** "Câu 12/40" — 13px, weight 600, màu `#334155`

### Đồng hồ đếm giờ (Timer)
- **Trạng thái bình thường:** nền `#F6F8FA`, chữ `#0F172A`, weight 700, border radius `10px`, padding `8px 16px`
- **Trạng thái sắp hết giờ (< 5 phút):** nền `#FEECEC`, chữ `#C53030`, có thể nhấp nháy nhẹ viền
- **Vị trí:** cố định góc trên phải màn hình làm bài, luôn hiển thị

### Thanh điều hướng câu hỏi (Question Navigator)
Lưới ô vuông nhỏ (36×36px, bo góc `8px`), mỗi ô là 1 câu hỏi:
- **Chưa làm:** nền `#FFFFFF`, viền `1.5px solid #E2E8F0`, chữ `#64748B`
- **Đã làm:** nền `#EAF6FF`, viền `#008BC5`, chữ `#008BC5`
- **Đang xem:** nền `#008BC5`, chữ `#FFFFFF`, shadow nhẹ `0px 2px 6px rgba(0,139,197,0.3)`
- **Đã đánh dấu review (cờ):** thêm chấm nhỏ `#FF7A00` ở góc trên phải ô
- **Không dùng cyan/tím ở đây** — giữ hệ đơn sắc xanh để không gây nhiễu khi có 40–60 câu

### Thẻ câu hỏi (Question Card)
- **Nền:** `#FFFFFF`, border radius `16px`, padding `32px`
- **Viền:** `1px solid #E2E8F0`
- **Shadow:** Level 1 (`0px 2px 8px rgba(15,23,42,0.06)`) — không dùng shadow nổi mạnh, tránh phân tán tập trung
- **Số thứ tự câu hỏi:** badge tròn `32px`, nền `#008BC5`, chữ trắng, weight 700
- **Nội dung câu hỏi:** Body Lớn (16px/26px), màu `#0F172A`

### Đáp án (Answer Options)
- **Trạng thái mặc định:** nền `#FFFFFF`, viền `1.5px solid #E2E8F0`, border radius `12px`, padding `14px 18px`, cả dòng có thể click (không chỉ radio)
- **Hover:** viền `#0693E3`, nền `#F0F9FF`
- **Đã chọn:** viền `2px solid #008BC5`, nền `#EAF6FF`, chữ weight 600
- **Sau khi nộp bài — Đúng:** viền `#22C55E`, nền `#F0FDF4`, icon check xanh lá
- **Sau khi nộp bài — Sai (đã chọn):** viền `#E53E3E`, nền `#FEECEC`, icon x đỏ
- **Sau khi nộp bài — Đáp án đúng (chưa chọn):** viền `#22C55E` nét đứt, để người thi thấy đáp án đúng dù chọn sai

### Thanh hành động cố định (Bottom Action Bar)
- **Nền:** `#FFFFFF`, border-top `1px solid #E2E8F0`, cố định đáy màn hình
- **Nút "Câu trước / Câu tiếp":** dùng nút Secondary (viền xanh)
- **Nút "Nộp bài":** dùng nút chính, nhưng đổi màu sang `#E53E3E` khi ở câu cuối để nhấn mạnh tính quyết định (không dùng cyan — tránh nhầm với "tính năng mới")

### Màn hình kết quả (Results Screen)
- **Khối điểm số tổng:** card lớn giữa trang, số điểm cỡ Display (40px/700), màu theo kết quả:
  - Đạt: `#22C55E` — Không đạt: `#E53E3E` — Trung bình/cảnh báo: `#F6AD37`
- **Biểu đồ phân loại câu đúng/sai:** dùng đúng 3 màu semantic (xanh lá/đỏ/xám `#94A3B8` cho câu bỏ trống), không thêm màu ngoài hệ thống
- **Bảng chi tiết từng câu:** hàng zebra nhẹ (`#F6F8FA` xen `#FFFFFF`), badge Đúng/Sai dùng đúng badge semantic đã định nghĩa ở mục 4

### Nguyên tắc riêng cho giao diện thi
- **Không dùng gradient** trong màn hình làm bài (khác với landing page) — giữ sự tập trung, tránh phân tán
- **Không dùng cyan `#00D9C0`** trong luồng thi — màu này để riêng cho khu vực marketing/tính năng mới, tránh gây nhiễu nghĩa với trạng thái làm bài
- **Toàn bộ trạng thái thi dùng đúng 4 màu:** xanh (`#008BC5` – đang làm/đã chọn), xanh lá (`#22C55E` – đúng/đạt), đỏ (`#E53E3E` – sai/không đạt), cam (`#FF7A00` – đánh dấu review)
- **Thẻ câu hỏi và đáp án không bo góc quá lớn** (tối đa 16px) để vẫn giữ sắc thái nghiêm túc, không "trẻ hóa" quá mức

## 10. Tóm tắt nhanh cho AI/Agent khi tạo UI

1. Màu chính: gradient `#0EA5E9 → #008BC5` (chỉ dùng cho landing/marketing). Riêng **luồng thi trắc nghiệm: dùng màu flat, không gradient**.
2. Màu nhấn "đổi mới" `#00D9C0`: chỉ dùng ngoài luồng thi (badge Mới/AI, trang giới thiệu). Không dùng trong màn hình làm bài.
3. Bo góc: 8px (nhỏ) / 12px (nút, đáp án) / 16px (card) / 999px (pill CTA, progress bar).
4. Shadow luôn mềm, mức thấp (Level 1) trong màn hình thi để không gây phân tán; Level 2–3 chỉ dùng cho landing/dropdown/modal.
5. Font Inter, H1 đậm (700) cho landing; trong màn hình thi ưu tiên rõ ràng, chữ số điểm/đồng hồ dùng weight 700.
6. Trạng thái thi trắc nghiệm chỉ dùng 4 màu cố định: xanh (`#008BC5`), xanh lá (`#22C55E`), đỏ (`#E53E3E`), cam (`#FF7A00`).
7. Khoảng trắng lớn ở landing (64–96px); trong màn hình thi dùng khoảng cách gọn hơn (16–24px) để hiển thị nhiều câu hỏi/điều hướng cùng lúc.
8. Input cao 44px, bo góc 10px, focus ring xanh mềm.
9. Badge "Mới/AI" luôn dùng cyan `#00D9C0` — chỉ ở khu vực ngoài luồng thi.
