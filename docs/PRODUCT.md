# Product scope — Component Marketplace

Quyết định cho issue #18 (research: Chốt phạm vi sản phẩm Marketplace), chốt
bởi @DaoDungVan ngày 2026-11-02. Đây là tài liệu quyết định sản phẩm — không
phải spec kỹ thuật; schema/contract cụ thể triển khai theo các quyết định ở
đây do @NguyenTuMinhLong (database/API) và @DaoDungVan (web/shared contract)
thống nhất riêng khi implement.

## MVP — tóm tắt

Marketplace bán **component UI, animation và tool** do **admin đăng** (không
có seller flow), qua một bước **duyệt tách biệt** trước khi hiện công khai.
Mỗi component có thể **miễn phí hoặc trả phí** (mix, không phải tất cả free
hay tất cả paid). Code luôn **MIT license** bất kể free/paid — khoản trả phí
(nếu có) không phải mua "quyền sử dụng code" mà là mua **quyền nhận bản cập
nhật mới** (kiểu DLC trong game: tải bản hiện tại luôn được, nhưng update lên
version mới hơn có thể cần mua thêm). Bản đầu có **catalog tìm kiếm theo
tags/category + preview trực tiếp**, hỗ trợ **mobile responsive**.

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

## 2. Giá và giao hàng

- **Mô hình mix**: từng component độc lập free hoặc paid — không phải
  toàn bộ catalog một mức giá.
- Giao hàng giữ nguyên pattern đã dựng trong UI (Figma Quick View panel):
  lệnh cài kiểu CLI copy-paste (`npx luva-ui add <slug>`), không phải tải
  file nén hay giao qua email.

## 3. License và cập nhật

- **License: MIT cho tất cả**, free lẫn paid — khoản phí (nếu có) không gắn
  với quyền sử dụng/sửa code, mà gắn với quyền **nhận version mới**.
- Cơ chế "DLC-style": mỗi component có một cờ independent với giá —
  component có thể tải/cài bản **hiện tại** luôn miễn phí tải về, nhưng nếu
  component được đánh dấu "update có phí", muốn **lên version mới hơn** thì
  cần mua. Component không đánh dấu cờ này thì update luôn miễn phí.
- **Phạm vi cho bước DB/schema đầu tiên**: chỉ cần mô hình hoá bằng field
  (ví dụ `price: number | null` — null nghĩa là free, và một cờ kiểu
  `requiresPaymentForUpdate: boolean`). **Xử lý thanh toán thật (Stripe/VNPay
  hay tương đương, entitlement/purchase record, gate truy cập update thực
  tế) KHÔNG nằm trong phạm vi "bước đầu database"** — đây là tính năng lớn
  riêng, cần issue/task riêng với scope và acceptance criteria rõ ràng sau
  khi MVP catalog chạy được.

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

Những điểm sau CHƯA chốt — không block MVP catalog cơ bản (free-only hoặc
data model có field giá nhưng chưa có payment thật), nhưng cần quyết định
trước khi xây tính năng thanh toán/update-gating thật:

1. **Payment provider cụ thể** (Stripe, VNPay, Momo, hay khác) — ngoài phạm
   vi đồ án tốt nghiệp nếu không có tài khoản merchant thật; có thể cần mock
   payment flow cho mục đích demo.
2. **Audit trail cho bước duyệt** — MVP dùng 2 trạng thái đơn giản
   (draft/published, không ghi lại ai duyệt lúc nào); nếu sau này cần nhiều
   admin cùng duyệt hoặc cần lịch sử, phải thêm bảng/field riêng — chưa cần
   cho MVP một mình admin.
3. **Cơ chế gate "mua để update"** cụ thể ở tầng API/CLI — ví dụ: lệnh
   `npx luva-ui add <slug>` kiểm tra quyền truy cập version mới bằng cách
   nào (token, tài khoản đăng nhập, license key) — chưa thiết kế, cần bàn
   riêng khi bắt đầu phần payment.
4. **Seller marketplace** — vẫn ngoài phạm vi MVP (xem mục 1), để ngỏ cho
   tương lai nếu dự án tiếp tục sau đồ án tốt nghiệp.

## Không mở issue triển khai cho từng câu hỏi

Theo đúng yêu cầu của issue #18: sau khi tài liệu này chốt MVP, chỉ mở issue
theo phần việc có thể giao và kiểm tra độc lập (ví dụ "thêm field
price/requiresPaymentForUpdate vào shared contract + schema", "cập nhật
`features/catalog/catalog-source.ts` dùng type từ `@marketplace/shared`" —
đúng scope của issue #56), có scope và acceptance criteria rõ ràng, không mở
issue riêng cho câu hỏi còn mở ở trên.
