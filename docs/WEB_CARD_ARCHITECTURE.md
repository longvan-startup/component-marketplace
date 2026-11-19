# Card catalog và trang chủ: ràng buộc thiết kế và kiến trúc

- Issue: [#176](https://github.com/longvan-startup/component-marketplace/issues/176) (owner: @DaoDungVan; Long review các ranh giới API và shared contract).
- Căn cứ: `main` tại `1809dd8` (sau #192). Baseline của khảo sát ban đầu là `3c4c480`.
- Trạng thái: tài liệu đề xuất, chờ owner xác nhận. Chỉ ghi những gì đã kiểm trong code và Figma; mục chưa có nguồn được đánh dấu rõ.

## 1. Kiểm kê hiện trạng

| Thành phần | Vị trí | Dùng ở | Ghi chú |
|---|---|---|---|
| `FeaturedCard` | `app/(site)/page.tsx` | Trang chủ, "Component nổi bật" | Khung cố định `rounded-[16px] bg-muted`. Hardcode, không dùng token `rounded-card` và `bg-card`. |
| `ComponentCard` | `components/catalog/component-card.tsx` | Trang `/components` | Có version, summary, badge "preview" cho bản nháp. Không có tác giả. |
| `DemoPreview` | `components/catalog/demo-preview.tsx` | Đầu cả hai card | Client island: iframe demo lazy, giới hạn 4 demo sống. Không có trong code trước #192. |
| `DemoBench` | `components/catalog/demo-bench.tsx` | Mở từ `DemoPreview` | Client island: popup `<dialog>` với thông số. |
| `Card` | `components/ui/card.tsx` | Mọi card | Có prop `interactive` nhưng không card nào dùng. |
| `Badge` | `components/ui/badge.tsx` | Card, trang chi tiết | Bốn tone: neutral, success, accent, danger. |
| `Chip` | `components/ui/chip.tsx` | Bộ lọc, nhóm thông số | Có `aria-pressed`. |
| `CatalogSkeleton` | `components/catalog/catalog-skeleton.tsx` | Trạng thái loading | Hình dạng card không khớp card nào (xem mục 4). |

Các trùng lặp cần xử lý:

- Bản đồ nhãn category xuất hiện ở ba nơi, và nhãn không thống nhất: trang chủ dùng "Animation / React component / Công cụ", `ComponentCard` dùng chữ thường "animation / component / tool".
- Bản đồ tier (`Free`/`Pro`) và variant badge lặp ở trang chủ, `ComponentCard` và trang chi tiết.
- Cùng một category có variant badge khác nhau: `animation` là `accent` ở catalog nhưng `neutral` ở trang chủ.

## 2. Nguồn thiết kế (Figma)

- File Luva UI, `Card/Component` (node `35:119`, nằm trong `Card Grid` `13:47`). Vị trí frame chứa Card Grid trên trang chưa xác định.
- Kích thước 282×278. Thumbnail 280×160 ở trên. Content gồm tên, "by {tác giả}", và hàng meta có badge (có một badge có chấm tròn).
- Thumbnail trong Figma là chỗ giữ vị trí tĩnh. Theo quyết định của owner, nội dung thật là demo sống, không phải ảnh. Kích thước 280×160 vẫn là ràng buộc bố cục.
- `get_design_context` chưa được đọc. Các biến thể Free và Pro chưa kiểm.

## 3. Ràng buộc thiết kế

| Hạng mục | Trạng thái | Nguồn |
|---|---|---|
| Token màu, radius (`rounded-card` = 1rem), border | Có | `globals.css`, `@theme` |
| Typography (Inter, cỡ chữ theo Figma) | Có | `layout.tsx`, `globals.css` |
| Spacing | Có một phần; card dùng `p-5`, FeaturedCard dùng `px-4 pb-4 pt-3.5`. Không thống nhất. | Code |
| Responsive | Có: 1 cột, 2 cột (sm), 3 cột (lg); trang chủ 4 cột (lg) | Code |
| Focus ring | Có: `focus-visible:ring-2 ring-ring` | Code |
| Touch target | `ComponentCard` có `min-h-11` ở tên; FeaturedCard chưa có | Code |
| Reduced motion | Có cho bench và demo; chưa có cho skeleton | Code |
| Trạng thái loading | Có skeleton, nhưng chưa khớp card (xem mục 4) | Code |
| Trạng thái empty | Có text "0 results" và "No components match" | Code |
| Trạng thái error | Có: "Catalog tạm thời chưa tải được" | Code |
| Trạng thái disabled | Chưa xác định cho card. Nút "Đăng ký cộng đồng" trên trang chủ dùng `aria-disabled`. | Code |
| Nhãn tiếng Việt | Phải dùng tiếng Việt cho mọi nút và nhãn người dùng thấy. Đã đổi nút popup thành "Xem thêm". | Quyết định của owner |

## 4. Kiến trúc đề xuất

Tầng, từ trên xuống:

1. **Page** (`app/`): Server Component, lấy dữ liệu qua feature source. Không gọi `lib/api-client` trực tiếp.
2. **Feature component** (`components/catalog/`, `components/home/`): ghép card từ primitive và dữ liệu đã có.
3. **Primitive** (`components/ui/`): Card, Badge, Chip, Button. Không có logic nghiệp vụ.

Quy tắc:

- Server Component là mặc định. Client island chỉ dùng cho tương tác hoặc browser API: `DemoPreview`, `DemoBench`, `CatalogSearch`.
- Dữ liệu đi qua `features/<name>/<name>-source.ts`. Với demo: `features/demo/demo-source.ts`.
- Contract (kiểu dữ liệu, validation) nằm trong `packages/shared`. Web không tự tạo bản sao lệch contract.
- Animation: GSAP là stack được duyệt cho web (`AGENTS.md`). Popup hiện dùng WAAPI của trình duyệt; cần owner quyết định có chuyển sang GSAP qua `lib/gsap.ts` hay không.
- Không thêm UI kit, state store, hay animation stack khác mà không có task riêng.
- Gom component chỉ khi có nhu cầu thực tế. Hai card khác thiết kế (`FeaturedCard` và `ComponentCard`) không được ép thành một component nếu làm mất khác biệt có chủ đích.

Các lát cắt đề xuất, theo thứ tự:

| Lát | Nội dung | Trạng thái | Ghi chú |
|---|---|---|---|
| L1 | Demo sống trên card và popup bench | Đã merge (#192) | Dùng dữ liệu mock |
| L2 | Hoạt ảnh popup, đóng khi bấm ngoài, nhãn tiếng Việt, kích thước | Đang mở (#194) | Chỉ đổi giao diện popup |
| L3 | Gom bản đồ nhãn, tier và variant badge vào `features/catalog/catalog-labels.ts` | Chưa làm | Không đổi giao diện. Đồng bộ nhãn tiếng Việt. |
| L4 | Skeleton khớp đúng card đã chọn | Chưa làm | Cần chốt card chuẩn trước |
| L5 | Chốt card chuẩn: thumbnail, có/không version và summary, có/không tác giả | Chưa làm | Cần quyết định của owner |
| L6 | Contract demo manifest và knob schema trong `packages/shared` | Chưa làm | Long review |
| L7 | Origin riêng cho demo, pipeline build bundle, CSP | Chưa làm | Hạ tầng; Long |

Acceptance criteria cho L3 đến L5 (đề xuất):

- Không đổi hành vi hiển thị ngoài phạm vi lát cắt. Chụp trước và sau cùng viewport để so sánh.
- Mọi nhãn người dùng thấy đều tiếng Việt và thống nhất giữa trang chủ và catalog.
- Skeleton có cùng chiều cao và số cột với card thật, để trang không nhảy khi dữ liệu về (CLS = 0).
- `bun run verify` PASS.

## 5. Quyết định đã chốt

- Demo chạy trong iframe sandbox `allow-scripts`, không có `allow-same-origin`.
- Thông số khai báo theo từng component; bộ điều khiển sinh từ khai báo.
- Thông số gửi qua `postMessage` có version, kiểm tra `event.source`.
- Tối đa 4 demo sống cùng lúc. Card ngoài hạn mức chờ slot.
- Không dùng ảnh chụp demo.
- Popup dùng `<dialog>` gốc, bo góc hai panel, nền trong suốt, kích thước 1040×600.
- Nút popup: "Xem thêm" (mở trang chi tiết, không thêm vào danh sách như bencho).

## 6. Quyết định chưa chốt

1. Card chuẩn: giữ hay bỏ version, summary và tác giả (L5).
2. Demo có origin riêng không, và đã có domain chưa (L7).
3. Trang chủ có demo sống không, hay chỉ catalog.
4. Trên mobile, kích hoạt demo bằng chạm có ổn không.
5. Ai sở hữu contract demo manifest (L6): đề xuất Long.
6. Danh sách catalog có hiện bản nháp (`isPublished: false`) không. Mock hiện có, API thật chưa xác nhận.
7. Vị trí frame Card Grid trong Figma.
8. Biến thể Free và Pro của card trong Figma.
9. Chuyển popup sang GSAP hay giữ WAAPI.

## 7. Ngân sách hiệu năng (đề xuất, chưa đo)

- Lúc tải trang: không mount iframe nào ngoài viewport. Demo không nằm trên đường tới LCP.
- Tối đa 4 iframe sống cùng lúc.
- CLS = 0 trên card.
- INP dưới 200 ms khi kéo thông số.
- Tôn trọng `prefers-reduced-motion`, dừng khi tab ẩn.
- Cách đo: Lighthouse mobile và Performance panel, so trước và sau, trên build production và sau deploy.

Trạng thái: chưa đo. Chưa deploy được, theo lịch sử #191.

## 8. Ngoài phạm vi

- Thay toàn bộ UI, dựng design system mới.
- Thêm UI kit hoặc state library.
- Đổi backend hoặc schema.
- Chỉnh Figma trong issue này.

## 9. Việc còn lại để đóng #176

- [x] Kiểm kê và baseline (mục 1, 2)
- [x] Tài liệu ràng buộc thiết kế và kiến trúc (file này)
- [x] Lát cắt card đầu tiên đã có code (L1, L2)
- [ ] Owner xác nhận tài liệu và các quyết định mục 6
- [ ] Long review contract demo (L6) và hạ tầng demo (L7)
- [ ] Chốt card chuẩn (L5), rồi làm L3 và L4
- [ ] Đo ngân sách hiệu năng trên production
