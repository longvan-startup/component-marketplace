# Card catalog và trang chủ: ràng buộc thiết kế và kiến trúc

- Issue: [#176](https://github.com/longvan-startup/component-marketplace/issues/176) (owner: @DaoDungVan; Long review các ranh giới API và shared contract).
- Căn cứ: `main` tại `1809dd8` (sau #192). Baseline của khảo sát ban đầu là `3c4c480`.
- Trạng thái: tài liệu đề xuất, chờ owner xác nhận. Ghi rõ điều đã kiểm trong code và Figma, điều là đề xuất, và điều chưa có nguồn.
- Ký hiệu: **[có]** đã có trong code, **[đề xuất]** chưa có, **[chưa có nguồn]** cần owner xác nhận.

## 1. Baseline và kiểm kê

| Thành phần | Vị trí | Dùng ở | Ghi chú |
|---|---|---|---|
| `FeaturedCard` | `app/(site)/page.tsx` | Trang chủ, "Component nổi bật" | Khung cố định `rounded-[16px] bg-muted`, hardcode. Không dùng token `rounded-card` và `bg-card`. |
| `ComponentCard` | `components/catalog/component-card.tsx` | Trang `/components` | Có version, summary, badge "preview" cho bản nháp. Không có tác giả. |
| `DemoPreview` | `components/catalog/demo-preview.tsx` | Đầu cả hai card | Client island: iframe demo lazy, giới hạn 4 demo sống. Thêm bởi #192. |
| `DemoBench` | `components/catalog/demo-bench.tsx` | Mở từ `DemoPreview` | Client island: popup `<dialog>` với thông số. Thêm bởi #192, chỉnh bởi #194. |
| `Card` | `components/ui/card.tsx` | Mọi card | Prop `interactive` có sẵn nhưng không card nào dùng. |
| `Badge` | `components/ui/badge.tsx` | Card, trang chi tiết | Bốn tone: neutral, success, accent, danger. |
| `Chip` | `components/ui/chip.tsx` | Bộ lọc, nhóm thông số | Có `aria-pressed`. |
| `CatalogSkeleton` | `components/catalog/catalog-skeleton.tsx` | Trạng thái loading | Hình dạng không khớp card nào (xem mục 4). |

Trùng lặp và không thống nhất cần xử lý:

- Bản đồ nhãn category xuất hiện ở ba nơi. Trang chủ dùng "Animation / React component / Công cụ", `ComponentCard` dùng chữ thường "animation / component / tool".
- Bản đồ tier (`Free`/`Pro`) và variant badge lặp ở trang chủ, `ComponentCard` và trang chi tiết.
- Cùng một category có variant khác nhau: `animation` là `accent` ở catalog, `neutral` ở trang chủ.

## 2. Nguồn thiết kế (Figma)

- File Luva UI, `Card/Component` (node `35:119`, trong `Card Grid` `13:47`). Vị trí frame Card Grid trên trang chưa xác định. **[chưa có nguồn]**
- Kích thước 282×278. Thumbnail 280×160 ở trên. Content gồm tên, "by {tác giả}", và hàng meta có badge, một badge có chấm tròn.
- Thumbnail trong Figma là chỗ giữ vị trí tĩnh. Theo quyết định của owner, nội dung thật là demo sống, không phải ảnh. Kích thước 280×160 vẫn là ràng buộc bố cục. **[có]**
- `get_design_context` chưa được đọc. Biến thể Free và Pro chưa kiểm. **[chưa có nguồn]**

## 3. Ràng buộc thiết kế

| Hạng mục | Trạng thái | Nguồn / ghi chú |
|---|---|---|
| Token màu, radius (`rounded-card` = 1rem), border | [có] | `globals.css`, `@theme` |
| Typography (Inter, cỡ chữ) | [có] | `layout.tsx`, `globals.css` |
| Spacing | [có một phần] | Card dùng `p-5`, FeaturedCard dùng `px-4 pb-4 pt-3.5`. Đề xuất thống nhất thành một thang. |
| Responsive | [có] | 1 cột, 2 cột (sm), 3 cột (lg); trang chủ 4 cột (lg). |
| Focus | [có] | `focus-visible:ring-2 ring-ring` trên link và nút. |
| Keyboard | [có một phần] | Link và nút focus được. Popup có focus trap và Esc qua `<dialog>`. Card không có thứ tự Tab hợp lý khi có demo. **[đề xuất]** |
| Touch target | [có một phần] | `ComponentCard` có `min-h-11` ở tên. FeaturedCard và nút demo chưa có. **[đề xuất]** 44px tối thiểu. |
| Contrast | [chưa đo] | Chữ `muted-foreground` (#52525b) trên `card` (#ffffff) và `muted` (#f4f4f5). **[đề xuất]** kiểm WCAG AA 4.5:1 bằng công cụ trước khi chốt. |
| Reduced motion | [có một phần] | Có cho popup và demo. Skeleton chưa có. **[đề xuất]** |
| Loading | [có] | Skeleton, nhưng chưa khớp card (mục 4). |
| Empty | [có] | "0 results", "No components match this query yet". |
| Error | [có] | "Catalog tạm thời chưa tải được". |
| Disabled | [chưa có nguồn] | Card chưa định nghĩa trạng thái này. Nút "Tham gia cộng đồng" trên trang chủ dùng `aria-disabled`. |
| Nhãn tiếng Việt | [có] | Mọi nhãn người dùng thấy phải tiếng Việt. Nút popup là "Xem thêm". |

## 4. Kiến trúc đề xuất

### 4.1 Tầng

1. **Page** (`app/`): Server Component. Lấy dữ liệu qua feature source, không gọi `lib/api-client` trực tiếp. **[có]**
2. **Feature component** (`components/catalog/`, `components/home/`): ghép card từ primitive và dữ liệu đã có. **[có]**
3. **Primitive** (`components/ui/`): Card, Badge, Chip, Button. Không có logic nghiệp vụ. **[có]**

### 4.2 Đặt tên, thư mục, public props **[đề xuất]**

- File component dùng kebab-case (`component-card.tsx`), export dùng PascalCase. Đúng với code hiện tại.
- Thư mục theo feature: `components/catalog/` cho card catalog, `components/home/` cho trang chủ, `components/ui/` cho primitive. Không tạo thư mục mới cho một component.
- Public props của card là `item` (kiểu `CatalogItem`) và tùy chọn `demo`. Không nhận className hay style tùy ý từ page; chỉ nhận variant có tên khi cần.
- Mỗi component export có JSDoc ngắn nêu mục đích và props bắt buộc.

### 4.3 Khi nào tách hoặc dùng chung **[đề xuất]**

- Tách thành component chung khi cùng hành vi và cùng thiết kế ở ít nhất hai nơi.
- Giữ riêng khi thiết kế khác có chủ đích. Hiện `FeaturedCard` và `ComponentCard` khác bố cục, nên không gom thành một.
- Gom chỉ dữ liệu dùng chung (nhãn, tier, variant) vào một module, không gom giao diện.

### 4.4 Ranh giới dữ liệu và hành vi

- Page dùng feature source (`features/catalog/catalog-source.ts`, `features/demo/demo-source.ts`). Contract và kiểu dữ liệu lấy từ `packages/shared`. **[có]**
- Server Component là mặc định. Client island chỉ dùng cho tương tác hoặc browser API: `DemoPreview`, `DemoBench`, `CatalogSearch`. **[có]**
- GSAP là stack được duyệt cho web, dùng qua `lib/gsap.ts` trong client island. Popup hiện dùng WAAPI của trình duyệt. **[chưa có nguồn]** Owner cần quyết định: chuyển popup sang GSAP hay giữ WAAPI.
- Mock và production:
  - `API_MODE=mock` (mặc định) dùng `mocks/`. `API_MODE=live` gọi API thật. Chuyển bằng env, không sửa code trang. **[có]**
  - Trang chỉ đọc qua feature source, không import `mocks/` trực tiếp. **[có]**
  - Demo manifest hiện chỉ có ở `mocks/demos.ts`, nên trên production không card nào có demo. Khi có contract, manifest đi từ API, không còn mock riêng. **[đề xuất]**
- Không thêm UI kit, state store, hay animation stack khác mà không có task riêng. **[có]**

### 4.5 Lát cắt đề xuất và thứ tự PR

| Lát | Nội dung | Trạng thái | Ghi chú |
|---|---|---|---|
| L1 | Demo sống trên card và popup bench | Đã merge (#192) | Dữ liệu mock |
| L2 | Hoạt ảnh popup, đóng khi bấm ngoài, nhãn tiếng Việt, kích thước | Mở (#194) | Chỉ đổi giao diện popup |
| L3 | Gom bản đồ nhãn, tier, variant vào `features/catalog/catalog-labels.ts` | Chưa làm | Không đổi giao diện, trừ nhãn đã chốt (mục 6) |
| L4 | Skeleton khớp card đã chọn | Chưa làm | Chặn bởi L5 |
| L5 | Chốt card chuẩn: thumbnail, version/summary, tác giả, bản nháp | Chưa làm | Cần quyết định owner (mục 6) |
| L6 | Contract demo manifest và knob schema trong `packages/shared` | Chưa làm | Long review |
| L7 | Origin riêng cho demo, pipeline build bundle, CSP | Chưa làm | Hạ tầng, Long |

## 5. Tiêu chí hoàn thành và cách kiểm chứng cho từng lát **[đề xuất]**

| Lát | File dự kiến | Acceptance criteria | Kiểm chứng |
|---|---|---|---|
| L3 | `features/catalog/catalog-labels.ts` mới; `component-card.tsx`; `app/(site)/page.tsx`; `app/(site)/components/[slug]/page.tsx` | Nhãn category và tier chỉ định nghĩa một chỗ; trang chủ và catalog hiển thị cùng nhãn; giao diện không đổi ngoài nhãn | `bun run verify` PASS; chụp trước và sau cùng viewport 1280px và 375px |
| L4 | `components/catalog/catalog-skeleton.tsx` | Chiều cao, số cột, padding khớp card thật; `aria-busy` và `role="status"` giữ nguyên | Đo chiều cao skeleton và card bằng DOM, khớp trong 1px; CLS = 0 khi chuyển từ skeleton sang dữ liệu |
| L5 | `components/catalog/component-card.tsx`, `app/(site)/page.tsx` | Card chuẩn có đúng các trường đã chốt; FeaturedCard và ComponentCard dùng cùng primitive cho phần chung | Đối chiếu từng trường với quyết định owner; chụp so với Figma |
| L6 | `packages/shared`, `features/demo/` | Contract có validation; web không tự tạo kiểu lệch | Long review; `bun run verify` PASS |
| L7 | `apps/api`, `packages/db`, cấu hình CSP | Demo chạy từ origin riêng, không đọc được cookie Luva | Long review; kiểm tra header và thử đọc `document.cookie` từ iframe |

Mọi lát đều cần: `bun run verify` PASS, số đo trước và sau ghi vào PR body, và kiểm tra bàn phím (Tab, Enter, Esc) trên các điều khiển mới.

## 6. Quyết định đã chốt

- Demo chạy trong iframe sandbox `allow-scripts`, không có `allow-same-origin`.
- Thông số khai báo theo từng component; bộ điều khiển sinh từ khai báo.
- Thông số gửi qua `postMessage` có version, kiểm tra `event.source`.
- Tối đa 4 demo sống cùng lúc. Card ngoài hạn mức chờ slot.
- Không dùng ảnh chụp demo.
- Popup dùng `<dialog>` gốc, bo góc hai panel, nền trong suốt, kích thước 1040×600.
- Nút popup: "Xem thêm" (mở trang chi tiết, không thêm vào danh sách như bencho).

## 7. Quyết định chưa chốt

1. Card chuẩn: giữ hay bỏ version, summary, tác giả (L5).
2. Demo có origin riêng không, và đã có domain chưa (L7).
3. Trang chủ có demo sống không, hay chỉ catalog.
4. Trên mobile, kích hoạt demo bằng chạm có ổn không.
5. Ai sở hữu contract demo manifest (L6). Đề xuất: Long.
6. Danh sách catalog có hiện bản nháp (`isPublished: false`) không. Mock hiện có, API thật chưa xác nhận.
7. Nhãn category: viết hoa như trang chủ hay chữ thường như catalog (L3).
8. Vị trí frame Card Grid trong Figma.
9. Biến thể Free và Pro của card trong Figma.
10. Popup dùng WAAPI hay chuyển sang GSAP.

## 8. Ngân sách hiệu năng (đề xuất, chưa đo)

- Lúc tải trang: không mount iframe nào ngoài viewport. Demo không nằm trên đường tới LCP.
- Tối đa 4 iframe sống cùng lúc.
- CLS = 0 trên card.
- INP dưới 200 ms khi kéo thông số.
- Tôn trọng `prefers-reduced-motion`, dừng khi tab ẩn.
- Cách đo: Lighthouse mobile và Performance panel, so trước và sau, trên build production và sau deploy.

Trạng thái: chưa đo. Chưa deploy được, theo lịch sử #191.

## 9. Ngoài phạm vi

- Thay toàn bộ UI, dựng design system mới.
- Thêm UI kit hoặc state library.
- Đổi backend hoặc schema.
- Chỉnh Figma trong issue này.

## 10. Việc còn lại để đóng #176

- [x] Kiểm kê và baseline (mục 1, 2)
- [x] Ràng buộc thiết kế và kiến trúc (mục 3, 4)
- [x] Lát cắt đề xuất với file, acceptance criteria, cách kiểm chứng (mục 4.5, 5)
- [x] Lát cắt card đầu tiên đã có code (L1, L2)
- [ ] Owner xác nhận tài liệu và các quyết định mục 7
- [ ] Long review contract demo (L6) và hạ tầng demo (L7)
- [ ] Chốt card chuẩn (L5), rồi làm L3 và L4
- [ ] Đo ngân sách hiệu năng trên production
