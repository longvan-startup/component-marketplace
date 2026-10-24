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

bun run verify       # GATE BẮT BUỘC trước mọi commit (lint+boundary+typecheck+test+build+Docker)
```

⚠️ `next build` có thể tự ghi đè `apps/web/tsconfig.json` — chạy
`git checkout apps/web/tsconfig.json` trước khi commit (issue #40).

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

## Cạm bẫy gotchas đã từng đánh

- `tsconfig.json` bị `next build` tự ghi → restore trước commit (#40).
- Biome pin chính xác `2.5.15` — không bump trong PR không liên quan.
- Tailwind v4 directives (`@theme`…) cần `css.parser.tailwindDirectives: true`
  trong `biome.json` (đã set, đừng bỏ).
- Marker smoke: trang catalog render `data-smoke="web"` — smoke probe grep
  marker, **không** grep nội dung UI (không đổi copy rồi vỡ CI).
- Branch FE: `feat/van-*`; PR mở chờ review — không merge hộ.
