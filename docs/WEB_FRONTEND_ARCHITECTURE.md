# Frontend `apps/web`: ràng buộc thiết kế và kiến trúc

- Issue: [#176](https://github.com/longvan-startup/component-marketplace/issues/176). Owner: @DaoDungVan. Long review các ranh giới API và shared contract.
- Căn cứ: `main` tại `73346ae` (sau #222 và #223).
- Trạng thái: tài liệu đề xuất, chờ owner xác nhận. Mỗi dòng ghi rõ: **[có trong code]**, **[đề xuất]**, hoặc **[chưa có nguồn]**.
- Phạm vi: toàn bộ frontend `apps/web`. Card catalog và trang chủ là phần việc đầu tiên để thử cách làm, không phải toàn bộ phạm vi.

## 1. Mục tiêu (theo issue)

Chốt ràng buộc thiết kế và kiến trúc frontend để các trang mới dùng lại component, giữ đúng thiết kế và dễ bảo trì. Làm theo phần việc nhỏ, không refactor toàn bộ frontend trong một PR. Không coi việc gom component là mục tiêu nếu nó làm mất khác biệt thiết kế.

## 2. Hiện trạng (kiểm kê)

Trang và component chính trên `main`:

| Khu vực | File | Ghi chú |
|---|---|---|
| Trang chủ | `app/(site)/page.tsx` | `FeaturedCard` định nghĩa trong file, hardcode `rounded-[16px] bg-muted` **[có trong code]** |
| Catalog | `app/(site)/components/page.tsx` | Dùng `ComponentCard`, có filter category **[có trong code]** |
| Chi tiết | `app/(site)/components/[slug]/page.tsx` | Badge category hiển thị raw `item.category` **[có trong code]** |
| Card catalog | `components/catalog/component-card.tsx` | Có version, summary, badge "preview" cho bản nháp **[có trong code]** |
| Demo trên card | `components/catalog/demo-preview.tsx` | Client island: iframe lazy, tối đa 4 demo sống **[có trong code, #192]** |
| Popup demo | `components/catalog/demo-bench.tsx` | Client island, mở và đóng bằng GSAP qua `useGsapScope` **[có trong code, #194 và #223]** |
| Primitive | `components/ui/` | `Card`, `Badge`, `Chip`, `Button`, `Input`, `Field`, `NavLink` **[có trong code]** |
| Skeleton | `components/catalog/catalog-skeleton.tsx` | Hình dạng không khớp card nào **[có trong code]** |

Các chỗ trùng lặp và không thống nhất, còn trên `main`:
- Nhãn category và tier lặp ở ba nơi: trang chủ dùng "Animation / React component / Công cụ" viết hoa, `ComponentCard` dùng chữ thường, trang chi tiết dùng raw `item.category` **[có trong code]**.
- Badge category: `animation` là accent ở catalog, neutral ở trang chủ **[có trong code]**.
- `Card` có prop `interactive` nhưng không component nào dùng **[có trong code]**.

Ghi chú: một commit gom nhãn (`85af99f`, PR #196) đã đóng và chưa vào `main`. Commit này vẫn còn trong lịch sử git cục bộ và có thể khôi phục.

## 3. Nguồn thiết kế (Figma)

- File Luva UI, `Card/Component` (node `35:119`, trong `Card Grid` `13:47`). Vị trí frame Card Grid trên trang chưa xác định **[chưa có nguồn]**.
- Kích thước 282×278. Thumbnail 280×160 ở trên. Content có tên, "by {tác giả}", và hàng meta có badge (một badge có chấm tròn) **[có nguồn]**.
- Theo quyết định của owner, thumbnail trong Figma là chỗ giữ vị trí tĩnh. Nội dung thật là demo sống, không phải ảnh **[có nguồn: owner]**. Kích thước 280×160 vẫn là ràng buộc bố cục.
- Biến thể Free và Pro chưa đối chiếu với `get_design_context` **[chưa có nguồn]**.

## 4. Ràng buộc thiết kế (theo hạng mục của issue)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Token màu, radius, border | [có trong code] | `globals.css` `@theme`. `rounded-card` = 1rem |
| Typography | [có trong code] | Inter qua `layout.tsx` |
| Spacing | [có một phần] | Card `p-5`, FeaturedCard `px-4 pb-4 pt-3.5`. Chưa thống nhất **[đề xuất]** |
| Responsive | [có trong code] | Catalog 1/2/3 cột; trang chủ 1/2/4 cột |
| Focus | [có trong code] | `focus-visible:ring-2 ring-ring` |
| Keyboard | [có một phần] | Link và nút focus được. Popup có focus trap và Esc |
| Touch target | [có một phần] | `ComponentCard` có `min-h-11` ở tên. FeaturedCard và nút demo chưa **[đề xuất]**: 44 px tối thiểu |
| Contrast | [chưa đo] | `muted-foreground` trên `card` và `muted`. **[đề xuất]** kiểm WCAG AA 4.5:1 bằng công cụ |
| Reduced motion | [có trong code] | Popup và demo. Skeleton chưa **[đề xuất]** |
| Loading | [có một phần] | Skeleton có nhưng không khớp card |
| Empty | [có trong code] | "0 results", "No components match this query yet" |
| Error | [có trong code] | "Catalog tạm thời chưa tải được" |
| Disabled | [chưa có nguồn] | Card chưa định nghĩa trạng thái này |
| Ngôn ngữ giao diện | [có nguồn: owner] | Mọi nhãn người dùng thấy là tiếng Việt |

## 5. Kiến trúc

### 5.1 Tầng

1. **Page** (`app/`): Server Component. Lấy dữ liệu qua feature source, không gọi `lib/api-client` trực tiếp **[có trong code]**.
2. **Feature component** (`components/catalog/`, `components/home/`): ghép card từ primitive và dữ liệu **[có trong code]**.
3. **Primitive** (`components/ui/`): không có logic nghiệp vụ **[có trong code]**.

### 5.2 Quy tắc đặt tên, thư mục, props **[đề xuất]**

- File kebab-case, export PascalCase. Đúng với code hiện tại.
- Thư mục theo feature. Không tạo thư mục mới cho một component.
- Props của card là `item` (kiểu `CatalogItem`) và tùy chọn `demo`. Không nhận className tùy ý từ page.

### 5.3 Khi nào tách hoặc dùng chung **[đề xuất]**

- Tách thành component chung khi cùng hành vi và cùng thiết kế ở ít nhất hai nơi.
- Giữ riêng khi thiết kế khác có chủ đích. `FeaturedCard` và `ComponentCard` khác bố cục, nên không gom.
- Gom dữ liệu dùng chung (nhãn, tier, variant) vào một module. Không gom giao diện.

### 5.4 Ranh giới dữ liệu và hành vi

- Page đọc dữ liệu qua feature source (`features/catalog/catalog-source.ts`, `features/demo/demo-source.ts`) **[có trong code]**.
- Contract và kiểu dữ liệu nằm trong `packages/shared` **[có trong code]**. Web không tự định nghĩa bản sao lệch contract.
- Server Component là mặc định. Client Component chỉ cho tương tác hoặc browser API **[có trong code, `apps/web/AGENTS.md`]**.
- Animation: GSAP qua `lib/gsap.ts` và `useGsapScope`, trong client island **[có trong code, #223]**.
- Mock và production: `API_MODE=mock|live` đổi nguồn dữ liệu bằng env, không sửa code trang **[có trong code]**. Demo manifest hiện chỉ có trong `mocks/demos.ts`. Khi có contract thật, manifest đi từ API **[đề xuất]**.
- Không thêm UI kit, state store, hay animation stack khác **[có trong code: `AGENTS.md`]**.

## 6. Phần việc và thứ tự PR

| Phần | Nội dung | Trạng thái | Ai quyết |
|---|---|---|---|
| Phần 1 | Demo sống trên card và popup | Đã merge (#192) | Owner |
| Phần 2 | Popup: hoạt ảnh, đóng bằng bấm ngoài, nhãn tiếng Việt, kích thước | Đã merge (#194) | Owner |
| Phần 2b | Popup chuyển sang GSAP | Đã merge (#223) | Owner |
| Phần 2c | Quy tắc web-conventions khớp bảng skill | Đã merge (#222) | Owner |
| Phần 3 | Gom nhãn category, tier, trạng thái vào một module | Chưa merge. Commit `85af99f` còn trong lịch sử cục bộ | Đã chốt: viết hoa chữ cái đầu; chờ làm | Owner (đã quyết) |
| Phần 4 | Skeleton khớp card đã chọn | Chưa làm | Chờ Phần 5 |
| Phần 5 | Chốt card chuẩn: thumbnail, version, summary, tác giả, bản nháp | Đã chốt: card gọn, khung demo lớn hơn; chờ làm | Owner (đã quyết) |
| Phần 6 | Contract demo manifest và knob schema trong `packages/shared` | Chưa làm | **Long** review |
| Phần 7 | Origin riêng cho demo, pipeline bundle, CSP | Chưa làm | **Long** |
| Phần 8 | Đo hiệu năng trên production | Chưa làm | Cần deploy từ `main` |

## 7. Tiêu chí hoàn thành và kiểm chứng

Cho từng lát, PR phải có:
- `bun run verify` PASS. Nếu chạy trên Windows có lỗi cài đặt của `apps/mobile` thì ghi rõ và xác nhận bằng CI Linux.
- Ảnh hoặc số đo trước và sau trên cùng viewport 1280 px và 375 px cho thay đổi giao diện.
- Kiểm tra bàn phím: Tab, Enter, Esc trên điều khiển mới.
- Đối chiếu từng acceptance criterion với code và test. CI xanh không thay bước này.

Ngân sách hiệu năng (đề xuất, chưa đo):
- Không mount iframe demo nào ngoài viewport.
- Tối đa 4 iframe sống cùng lúc.
- CLS = 0 trên card.
- INP dưới 200 ms khi kéo thông số.
- Tôn trọng `prefers-reduced-motion` và dừng khi tab ẩn.

## 8. Quyết định của owner (Văn), đã chốt ngày 2026-11-22

1. **Card chuẩn (Phần 5):** card chỉ hiện khung demo (lớn hơn hiện tại), tên, tag, tier (Pro hoặc Free) và tác giả. Version và summary chuyển sang trang chi tiết. Kích thước khung demo cụ thể chốt khi làm Phần 5.
2. **Nhãn category (Phần 3):** viết hoa chữ cái đầu của cụm từ: `Animation`, `React component`, `Công cụ`. Khớp với nút lọc trên catalog.
3. **Badge category (Phần 3):** tất cả badge category đều neutral. Màu tím chỉ dùng cho tier Pro.
4. **Biến thể Free và Pro trong Figma:** Figma hiện chưa có tier. Code là chuẩn, Figma sẽ được cập nhật theo code sau (việc của Văn, không làm trong PR).
5. **Bản nháp trong catalog:** chưa quyết trong buổi này. Cần xác nhận hành vi API thật (Long) trước khi chốt.
## 9. Quyết định cần Long

1. **Contract demo manifest và knob schema (Phần 6)** trong `packages/shared`.
2. **Origin riêng cho demo, pipeline bundle, CSP (Phần 7).**
3. **Quyết ADR-01, ADR-03, ADR-04** trong `docs/HARNESS_AUDIT.md` cùng Văn, vì liên quan đến quy tắc chung.

## 10. Ngoài phạm vi

- Thay toàn bộ UI hoặc dựng design system mới.
- Thêm UI kit hoặc state library.
- Đổi backend, schema, hay Figma trong issue này.

## 11. Việc còn lại để đóng #176

- [x] Kiểm kê và baseline (mục 2, 3)
- [x] Ràng buộc thiết kế và kiến trúc (mục 4, 5)
- [x] Phần việc đầu tiên đã merge (Phần 1, Phần 2, Phần 2b, Phần 2c)
- [x] Owner chốt quyết định mục 8
- [ ] Long review Phần 6 và Phần 7
- [ ] Phần 3, Phần 4 và Phần 5 theo quyết định của owner
- [ ] Đo hiệu năng trên production (Phần 8)
- [ ] Owner xác nhận tài liệu này

## 12. Kiểm kê toàn bộ frontend (bổ sung theo title #176)

Phần này bao phủ toàn bộ `apps/web`, không chỉ card. Dữ liệu lấy từ danh sách file và lệnh tìm kiếm trên `main` tại thời điểm viết. Các điểm dưới đây là quan sát, chưa phải lỗi đã kiểm chứng trên trình duyệt.

### 12.1 Trang

| Trang | Đường dẫn | Ghi chú |
|---|---|---|
| Trang chủ | `/` | Có loading, không có `error.tsx` |
| Catalog | `/components` | Có `loading.tsx` |
| Chi tiết component | `/components/[slug]` | Có `loading.tsx`; slug không tồn tại gọi `notFound()` |
| Đăng nhập | `/login` | Không có loading riêng |
| Đăng ký | `/register` | Không có loading riêng |
| Quên mật khẩu | `/forgot-password` | Không có loading riêng |
| Đặt lại mật khẩu | `/reset-password` | Không có loading riêng |
| Xác minh email | `/verify-email`, `/verify-email/success` | Không có loading riêng |
| Bảng giá | `/pricing` | Không có loading riêng |
| Bảo mật tài khoản | `/account/security` | Không có loading riêng |

Không có `not-found.tsx` và không có `error.tsx` trong toàn bộ `app/`. Trang 404 đang dùng mặc định của Next.js.

### 12.2 Thành phần chia nhóm

- **Layout:** `nav-bar`, `nav-auth`, `nav-session`, `mobile-menu`, `search-form`, `footer`, `footer-dot-field`, `newsletter-form`, `logo`, `site-shell`.
- **Auth:** `sign-in-form`, `sign-up-form`, `forgot-password-form`, `reset-password-form`, `verify-email-result`, `security-settings`, `social-buttons`, `auth-shell`, `auth-showcase`, `auth-status-banner`.
- **Catalog:** `component-card`, `catalog-search`, `catalog-skeleton`, `demo-preview`, `demo-bench`, `knob-controls`.
- **Home:** `hero-backdrop`, `hero-bubbles`, `hero-bubble-motion`, `hero-dot-field`.
- **Primitive** (`components/ui/`): `button`, `card`, `badge`, `chip`, `field`, `input`, `nav-link`, `page-button`, `icons`.

### 12.3 Điểm không nhất quán quan sát được

1. **Primitive không được dùng đều.** Có `Button`, `Input`, `Field` nhưng nhiều nơi vẫn dùng `<button>` và `<input>` trực tiếp: `social-buttons`, `mobile-menu`, `newsletter-form`, `search-form`, `catalog-search`.
2. **Màu hardcode ngoài token.** Ngoài `globals.css` và icon, màu hex nằm trong `hero-bubble-motion.ts` (ba màu tím).
3. **Chuyển động không đi qua GSAP.** Hero dùng CSS keyframes và vòng lặp `requestAnimationFrame` riêng (`hero-bubbles`, `hero-bubble-motion`, `hero-dot-field`). `apps/web/AGENTS.md` quy định GSAP là entry duy nhất. Đây là điểm cần quyết định: chuyển sang GSAP, hay ghi ngoại lệ có lý do.
4. **Copy tiếng Anh lẫn trong giao diện.** Ví dụ: nhãn "Latest version", "← Back to catalog" trên trang chi tiết. Quy tắc giao diện là tiếng Việt, cần rà soát toàn bộ.
5. **Trạng thái loading và lỗi chưa đồng đều.** Chỉ catalog và chi tiết có `loading.tsx`. Các trang auth, pricing và bảo mật không có. Không có trang lỗi chung.

### 12.4 Quyết định cần owner cho toàn bộ frontend

1. Hero và footer: dùng GSAP hết, hay cho phép ngoại lệ cho canvas và hiệu ứng nền?
2. Quy tắc dùng primitive: bắt buộc `Button`, `Input`, `Field` cho mọi nơi, hay chỉ cho form?
3. Trang 404 và trang lỗi: thiết kế riêng, copy tiếng Việt.
4. Trạng thái loading cho các trang auth, pricing, bảo mật: cần không, và cần kiểu nào.
5. Các màu hardcode trong hero: chuyển sang token, hay giữ vì là phần minh họa.
