# apps/web — Frontend

Tài liệu tiếp nhận cho người mới vào phần frontend. Quy tắc kỹ thuật dày hơn:
`apps/web/AGENTS.md`; chuẩn chung cả repo: `../../README.md` +
`../../docs/ENGINEERING.md`.

## Stack

| Thư viện | Phiên bản | Vai trò |
|---|---|---|
| Next.js (App Router) | `^16.4.2` | Framework — **RSC mặc định**, client island chỉ khi cần |
| React | `^19.2.0` | |
| TypeScript | `^7.0.2` — strict | |
| Tailwind CSS | `^4` | Styling duy nhất; design tokens trong `@theme` (light-only) |
| GSAP | `^3.15.0` | Animation — **chỉ qua `lib/gsap.ts`** (xem [§ Animation](#animation--gsap)) |
| Zod (qua `@marketplace/shared`) | 4 | Contract FE/BE dùng chung |

**Cố ý không có** (chỉ thêm khi có task chứng minh use case): state store
(Zustand/Redux), UI kit (shadcn/ui), Storybook, framer-motion.

## Bắt đầu nhanh

```bash
bun install          # từ root monorepo

bun run dev:web      # dev server :3000
bun run dev:api      # API :4000 (cần khi API_MODE=live)

bun run verify       # lint + boundary + typecheck + test + build
bun run verify --docker # thêm Docker runtime smoke cách ly
```

`bun run --cwd apps/web typecheck` tạo lại route types bằng `next typegen`. Typecheck và production build dùng `tsconfig.typecheck.json` để không kiểm tra các type cũ trong `.next/dev`; dev vẫn dùng `tsconfig.json`.

## Cấu trúc

```text
apps/web/
├── app/                    # R routes — RSC mặc định
│   ├── layout.tsx | page.tsx | globals.css   (tokens Tailwind @theme ở đây)
│   └── components/[slug]/  # trang detail theo slug (khớp contract :slug)
├── components/
│   ├── ui/                 # badge, card — primitives thuần
│   ├── catalog/            # card, search (client), preview panel
│   └── layout/             # shell/site-level layout
├── features/catalog/
│   ├── catalog-source.ts   # ★ ĐIỂM TRUY DỮ LIỆU DUY NHẤT — mock | live
│   └── catalog-source.test.ts
├── lib/
│   ├── api-client.ts       # HTTP client + base URL theo runtime (có test)
│   └── gsap.ts             # useGsapScope — entry animation duy nhất
├── mocks/                  # dữ liệu mock (API_MODE=mock)
└── AGENTS.md               # quy tắc cho agent/reviewer
```

Quy tắc dữ liệu (review blocker): component **không** tự fetch, **không**
import `mocks/` trực tiếp — mọi dữ liệu phải qua `getCatalogSource()`
trong `features/catalog/catalog-source.ts`.

## Luồng dữ liệu & biến môi trường

| Env | Ai đọc | Dùng khi nào |
|---|---|---|
| `API_MODE` | `catalog-source.ts` | `mock` (mặc định — dev/preview) \| `live` |
| `API_URL_INTERNAL` | `lib/api-client.ts` (SSR) | Binding tự inject từ `vercel.json` trên Vercel — **không set thủ công** |
| `NEXT_PUBLIC_API_URL` | `lib/api-client.ts` (browser) | Khi API có domain công khai riêng; không set → same-origin `/api` |

Trên Vercel (Services, cấu hình `vercel.json` ở root): mỗi PR có **preview**
(2 service api + web), `main` = production. Browser gọi API qua same-origin
`/api/*`; SSR đi qua binding, không cần CORS.

## Animation — GSAP

GSAP **cài sẵn** (`^3.15.0`). Tiếp nhận chỉ cần nhớ 3 quy tắc:

1. **Chỉ client island**: ghi `'use client'`, dùng hook
   `useGsapScope` từ `lib/gsap.ts` — không import `gsap` trong RSC.
2. **Cleanup tự động**: mọi tween tạo trong `setup` bị `revert()` khi
   unmount — không cần tự viết cleanup.
3. **`prefers-reduced-motion` được xử lý sẵn**: người dùng bật giảm motion ⇒
   `setup` không chạy — không cần if trong code animation.

Ví dụ chuẩn (copy được ngay):

```tsx
// components/catalog/catalog-hero.tsx — client island
'use client'
import { useRef } from 'react'
import { useGsapScope } from '../../lib/gsap'

export function CatalogHero() {
  const scopeRef = useRef<HTMLDivElement>(null)

  // Chạy 1 lần sau mount; tự gọn khi unmount; tự tắt khi reduced motion.
  useGsapScope(scopeRef, ({ gsap, qa }) => {
    gsap.from(qa('.hero-line'), { y: 12, opacity: 0, stagger: 0.06 })
  })

  return (
    <div ref={scopeRef}>
      <h1 className="hero-line px-2 text-3xl">Component</h1>
      <h1 className="hero-line px-2 text-3xl">Marketplace</h1>
    </div>
  )
}
```

Chọn công cụ nào?

| Nhu cầu | Dùng |
|---|---|
| đổi màu/hover xuất hiện đơn giản | **class Tailwind** (transition/`@starting-style`) — rẻ nhất |
| sequence, stagger, scroll-timeline | **GSAP qua `useGsapScope`** |
| phức tạp hơn nữa (layout animation…) | mở issue trước — mặc định không thêm framer-motion |

Không dùng: animation điều khiển bằng state store, plugin đăng ký global,
GSAP chạy trực tiếp trong RSC. Bundle cost giảm dần theo thứ tự trên.

## Responsive

Quy tắc dùng chung cho mọi màn hình (issue #85), áp dụng khi tạo UI mới:

- **Kiểm tra tối thiểu các viewport**: 320, 360, 375, 390, 414, 768, 1024,
  1280, 1440 CSS px. Không tạo breakpoint riêng cho từng giá trị — dùng đúng
  breakpoint Tailwind sẵn có (`sm:`/`md:`/`lg:`...), các giá trị trên chỉ là
  điểm kiểm tra tràn/chồng lấn.
- **Không bao giờ để nội dung chính tràn ngang** (320–1440px). Kiểm tra bằng
  `document.documentElement.scrollWidth > window.innerWidth` trong devtools,
  không chỉ nhìn ảnh chụp — một phần tử rộng hơn viewport có thể không lộ
  rõ trên ảnh nhỏ.
- **Vùng chạm (nút/link chính) tối thiểu 44×44 CSS px.** Pattern dùng:
  `inline-flex min-h-11 items-center` trên link/button inline (xem
  `components/layout/site-shell.tsx` nav link, `components/catalog/
  component-card.tsx` title link) hoặc `min-h-11` trực tiếp trên input/button
  block-level (xem `components/catalog/catalog-search.tsx`). Logo/link dạng
  text thuần không bắt buộc đạt 44px nếu không phải hành động chính — ghi rõ
  ngoại lệ khi gặp.
- **Focus ring phải thấy rõ, không chỉ tồn tại trong CSS.** Tránh ring cùng
  tông màu + opacity thấp đè lên nền cùng màu (ví dụ ring tím mờ trên nút
  nền tím — gần như vô hình). Dùng `focus-visible:ring-2 focus-visible:
  ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`
  để ring tách khỏi nền bằng khoảng trắng, luôn kiểm bằng cách Tab thật rồi
  chụp/zoom ảnh, không suy luận từ class name.
- **Footer/header dùng chung đổi bố cục theo chiều rộng thay vì ép dính.**
  Ví dụ footer: `flex-col` + căn giữa dưới `sm:`, chuyển `sm:flex-row
  sm:justify-between` khi đủ rộng — tránh 2 khối text bị ép cạnh nhau co hẹp
  khi màn hình hẹp.
- Khi route/thành phần mới có nội dung dài (tên, slug, tag), test bằng cách
  tạm thế chuỗi dài qua devtools console trước khi khẳng định không tràn —
  dữ liệu mock hiện tại không đủ dài để tự lộ bug.

## Cạm bẫy gotchas đã từng đánh

- Nếu thay đổi route, chạy lại typecheck để tạo route types mới.
- Biome pin chính xác `2.5.15` — không bump trong PR không liên quan.
- Tailwind v4 directives (`@theme`…) cần `css.parser.tailwindDirectives: true`
  trong `biome.json` (đã set, đừng bỏ).
- Marker smoke: trang catalog render `data-smoke="web"` — smoke probe grep
  marker, **không** grep nội dung UI (không đổi copy rồi vỡ CI).
- Branch FE: `feat/van-*`; PR mở chờ review — không merge hộ.
