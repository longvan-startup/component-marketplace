# Product scope — Component Marketplace

Quyết định cho issue #18 (research: Chốt phạm vi sản phẩm Marketplace), chốt
bởi @DaoDungVan ngày 2026-11-02. Đây là tài liệu quyết định sản phẩm — không
phải spec kỹ thuật; schema/contract cụ thể triển khai theo các quyết định ở
đây do @NguyenTuMinhLong (database/API) và @DaoDungVan (web/shared contract)
thống nhất riêng khi implement.

> **Cập nhật 2026-11-11 (@DaoDungVan): mô hình bán hàng đổi sang membership
> Free + Pro.** Mục 2 và 3 bên dưới thay thế quyết định "giá từng component +
> trả tiền để nhận bản cập nhật (kiểu DLC)" của bản 2026-11-02. Thiết kế kỹ
> thuật đề xuất nằm ở [`docs/rfcs/membership.md`](rfcs/membership.md), đang
> chờ @NguyenTuMinhLong duyệt — cho tới khi RFC đó được duyệt và có task
> riêng, schema/contract/API hiện tại (`price`, `requiresPaymentForUpdate`)
> giữ nguyên, không ai sửa theo tài liệu này.

## MVP — tóm tắt

Marketplace bán **component UI, animation và tool** do **admin đăng** (không
có seller flow), qua một bước **duyệt tách biệt** trước khi hiện công khai.
Mỗi component thuộc một trong hai nhóm: **Free** (ai cũng cài được) hoặc
**Pro** (chỉ thành viên gói Pro cài được). Người dùng **không mua từng
component và không trả tiền theo từng phiên bản** — họ đăng ký gói thành viên
(tương tự cách chia gói Free/Pro của các sản phẩm SaaS). Code luôn **MIT
license**. Bản đầu có **catalog tìm kiếm theo tags/category + preview trực
tiếp**, hỗ trợ **mobile responsive**.

## 1. Sản phẩm và người bán

- Bán: UI component, animation, tool (giữ nguyên 3 category hiện có trong
  `packages/shared/src/contracts/catalog.ts`: `animation` | `react-component`
  | `tool`).
- Chỉ **admin đăng** — không có seller marketplace. Khớp với
  `docs/COMMUNITY_ARCHITECTURE.md` §10 (đã loại seller/payments flow khỏi MVP
  của module Community) và giữ nguyên hướng đó cho cả Catalog.
- Mỗi component phải qua **bước duyệt tách biệt** trước khi public, kể cả do
  admin tự đăng — tạo xong không tự động hiện trên catalog. Cho MVP: đủ dùng
  2 trạng thái (draft / published), ánh xạ đúng field `isPublished` đã có sẵn
  trong `packages/db/src/schema.ts` — ràng buộc thêm là **tạo mới luôn mặc
  định `isPublished=false`**, publish là một hành động riêng. Không cần bảng
  audit/review-queue cho MVP (xem "Câu hỏi còn mở").

## 2. Gói thành viên và giao hàng

- **Hai gói: Free và Pro.** Không có giá riêng cho từng component.
  - **Free** (mặc định khi đăng ký tài khoản): xem và preview **mọi**
    component; cài các component nhóm Free.
  - **Pro** (trả theo kỳ — tháng hoặc năm): cài **mọi** component, gồm cả
    nhóm Pro, và luôn lấy được **bản mới nhất** trong lúc gói còn hiệu lực.
- Mỗi component chỉ mang **một nhãn truy cập** (`free` hoặc `pro`) do admin
  đặt khi đăng — thay cho cặp `price` + `requiresPaymentForUpdate`.
- Giao hàng giữ nguyên pattern đã dựng trong UI (Figma Quick View panel):
  lệnh cài kiểu CLI copy-paste (`npx luva-ui add <slug>`), không phải tải
  file nén hay giao qua email. Lệnh này chép mã nguồn vào dự án của người
  dùng.

## 3. License, phiên bản và hết hạn gói

- **License: MIT cho tất cả**, Free lẫn Pro — gói Pro là quyền **truy cập để
  cài**, không phải quyền sử dụng code đã cài.
- **Không còn trả tiền theo phiên bản.** Thành viên Pro luôn cài được bản mới
  nhất; không có khái niệm "mua bản cập nhật".
- **Khi gói Pro hết hạn**: code đã cài nằm trong dự án của người dùng nên vẫn
  chạy và vẫn được dùng (MIT). Họ chỉ không cài thêm component Pro và không
  kéo bản mới của component Pro cho tới khi gia hạn. Component Free không bị
  ảnh hưởng.
- **Vì sao bỏ mô hình DLC (quyết định 2026-11-02)**: bán theo phiên bản buộc
  hệ thống phải theo dõi ai đang ở bản nào và được lên bản nào; người không
  mua bản mới bị kẹt ở bản cũ và có thể gặp lỗi khi các component khác đã lên
  bản mới — phức tạp cho cả người dùng lẫn người làm. Membership gom lại
  thành một câu hỏi duy nhất: gói còn hiệu lực hay không.
- **Thanh toán thật vẫn ngoài phạm vi cho tới khi có task riêng**: nhà cung
  cấp thanh toán, bản ghi đăng ký, kiểm tra quyền khi cài — xem RFC. Giai
  đoạn này web chỉ dựng trang Bảng giá và nhãn Pro bằng dữ liệu mock.

## 4. Tìm và xem trước

- Catalog với filter theo **tags + category** + **search theo tên/summary**
  — đúng pattern đã có trong `features/catalog/catalog-source.ts`
  (`filterMockComponents`).
- **Preview trực tiếp** trên catalog/detail — đúng pattern Quick View panel
  đã dựng trong Figma (mở panel xem chi tiết + preview mà không rời trang
  danh sách).
- **Cần hỗ trợ mobile** — responsive, không chỉ desktop, vì đây là trang
  marketplace công khai.

## Câu hỏi còn mở

Những điểm sau CHƯA chốt — không block MVP catalog cơ bản (chưa có thanh toán
thật), nhưng cần quyết định trước khi xây tính năng membership thật:

1. **Payment provider cụ thể** (Stripe, VNPay, Momo, hay khác) — ngoài phạm
   vi đồ án tốt nghiệp nếu không có tài khoản merchant thật; có thể cần mock
   payment flow cho mục đích demo. Kèm theo: **giá gói Pro** theo tháng/năm
   chưa chốt.
2. **Audit trail cho bước duyệt** — MVP dùng 2 trạng thái đơn giản
   (draft/published, không ghi lại ai duyệt lúc nào); nếu sau này cần nhiều
   admin cùng duyệt hoặc cần lịch sử, phải thêm bảng/field riêng — chưa cần
   cho MVP một mình admin.
3. **Cơ chế kiểm tra quyền Pro khi cài** ở tầng API/CLI — lệnh
   `npx luva-ui add <slug>` chứng minh người chạy là thành viên Pro bằng
   cách nào (token cá nhân, đăng nhập qua trình duyệt, license key) — chưa
   thiết kế; RFC membership liệt kê các phương án.
4. **Seller marketplace** — vẫn ngoài phạm vi MVP (xem mục 1), để ngỏ cho
   tương lai nếu dự án tiếp tục sau đồ án tốt nghiệp.

## Không mở issue triển khai cho từng câu hỏi

Theo đúng yêu cầu của issue #18: sau khi tài liệu này chốt MVP, chỉ mở issue
theo phần việc có thể giao và kiểm tra độc lập (ví dụ "thêm field
price/requiresPaymentForUpdate vào shared contract + schema", "cập nhật
`features/catalog/catalog-source.ts` dùng type từ `@marketplace/shared`" —
đúng scope của issue #56), có scope và acceptance criteria rõ ràng, không mở
issue riêng cho câu hỏi còn mở ở trên.
