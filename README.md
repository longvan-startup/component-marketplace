# Component Marketplace

Monorepo nền tảng (Foundation) cho component & animation marketplace:
**nền tảng — Docker, CI/CD, hợp đồng API, web data layer — đã hoàn thành;**
business logic (catalog thật, auth, payment, community) theo tiến độ ở
epic #28. Catalog hiện chạy **mock data** (chi tiết: [Web & API mode](#web--api-mock--live)).

## Stack

| Lĩnh vực | Công nghệ |
|---|---|
| Monorepo | Bun Workspaces |
| Frontend | Next.js + TypeScript (strict) + Tailwind v4 (design tokens trong `@theme`) |
| Backend | Bun + Express + TypeScript |
| Database | PostgreSQL / Neon (production) |
| ORM | Drizzle ORM (`@marketplace/db`, migrations, postgres.js) |
| Contract | Zod 4 (`@marketplace/shared` — DTO + envelope dùng chung FE/BE) |
| Lint | Biome (pin chính xác 2.5.15 — không bump trong PR không liên quan) |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Hosting | **Vercel Services** (1 project: web public + api internal, cùng domain; kích hoạt qua dashboard — owner-manual), API có thể lên thêm **VPS Mắt Bão** (GHCR + SSH, gated) |

**Tích hợp sau** (chưa cài dependency, chỉ ghi nhận): Better Auth,
Lemon Squeezy, Cloudflare R2, Expo (mobile), Playwright + Gemini (AI Factory).
Thiết kế domain Community (Forum) + Live Chat: xem `docs/COMMUNITY_ARCHITECTURE.md`.

## Cấu trúc

```text
component-marketplace/
├── apps/
│   ├── web/                 # Next.js (port 3000) — cấu trúc theo feature
│   │   ├── app/             # routes (RSC mặc định, chỉ 2 client island)
│   │   ├── components/      # ui/ | layout/ | catalog/
│   │   ├── features/catalog/
│   │   │   └── catalog-source.ts    # ĐIỂM TRUY DỮ LIỆU DUY NHẤT của web
│   │   ├── lib/api-client.ts        # HTTP client + base URL theo runtime
│   │   └── mocks/                   # data mock (API_MODE=mock)
│   └── api/                 # Bun + Express (port 4000; health: /health, /health/db)
│       └── src/index.ts     # mount '/' (Docker) và '/api' (Vercel) song song
├── packages/
│   ├── shared/              # @marketplace/shared
│   │   └── src/contracts/   # zod contracts: catalog.ts, common.ts (+ test colocated)
│   └── db/                  # @marketplace/db: schema + client
│       ├── src/schema.ts    # bảng users, components
│       └── drizzle/         # migrations SQL (được commit)
├── scripts/                 # verify.sh (+ docker-smoke.lib.sh, check-boundaries.mjs)
├── docker/
│   ├── web.Dockerfile
│   └── api.Dockerfile
├── docs/                    # ENGINEERING.md | DEPLOYMENT.md | COMMUNITY_ARCHITECTURE.md
├── .github/
│   ├── workflows/           # ci.yml | cd.yml | owner-scope.yml | auto-assign-reviewers.yml | auto-issue.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── .agents/skills/          # skill kit cho AI agent (tư vấn trước khi làm mới)
├── vercel.json              # Vercel Services: api (internal) + web (public) + binding
├── compose.yaml
├── .dockerignore / .gitignore / .env.example
├── biome.json / tsconfig.base.json
├── AGENTS.md / CONTRIBUTING.md
└── package.json
```

## Scripts (chạy từ root)

```bash
bun install          # cài dependencies toàn monorepo

bun run dev:web      # Next.js dev server :3000
bun run dev:api      # Bun API dev (hot reload) :4000, health DB: /health/db

bun run build        # build shared → db → api → web
bun run typecheck    # tsc --noEmit cho shared + db + api + web
bun run test         # bun test — smoke test API (bun:test)
bun run lint         # Biome check
bun run lint:fix     # Biome fix tự động

bun run boundary     # kiểm tra workspace imports — không cross-domain tự do
bun run verify       # FULL pipeline: lint + boundary + typecheck + test + build + Docker stack
bun run verify --docker-only   # chỉ phần Docker (parity với CI)
```

**`bun run verify` là gate bắt buộc trước mọi PR** — các check `Lint`,
`Typecheck`, `Test`, `Build` là required checks trên branch protection `main`.

## Contract API (packages/shared)

Zod 4 schemas dùng chung FE/BE — không tự đoán shape ở hai phía:

- `componentSchema` — DTO công khai của component (chỉ field DB công khai);
- `listRequestSchema` — mặc định `page 1` / `pageSize 12` / `sort newest`, max
  10000/48;
- `listResponseSchema` — envelope `{ items, page, pageSize, total }`;
- `detailResponseSchema` — envelope `{ item }`; detail endpoint dùng **`:slug`**
  (không `:id`);
- `apiErrorSchema` — code `UPPER_SNAKE` + `status` 400–599.

## Web & API (mock | live)

- `API_MODE=mock|live` đổi nguồn dữ liệu catalog chỉ tại
  `features/catalog/catalog-source.ts` — web **không bao giờ** import
  backend/db, mọi dữ liệu đi qua HTTP.
- Base URL theo runtime (xem `lib/api-client.ts`):
  - browser → `NEXT_PUBLIC_API_URL`, không có thì dùng same-origin `/api`;
  - server (SSR) → `API_URL_INTERNAL` (binding từ `vercel.json`) →
    `NEXT_PUBLIC_API_URL` → same-origin `/api`.
- Trang catalog render marker ổn định `data-smoke="web"` (dùng cho smoke
  probe — không grep nội dung UI).
- Trên Vercel: path công khai của API là `/api/*` cùng domain; nội bộ
  (SSR) đi qua binding, path gốc; Docker giữ nguyên `/`, `/health`.

## Database (Drizzle ORM)

Workspace `packages/db` (`@marketplace/db`) — schema + client dùng chung:

```bash
bun run db:generate  # sinh migration từ schema.ts (packages/db/drizzle/*.sql)
bun run db:migrate   # áp migration vào DB (cần DATABASE_URL / postgres compose đang chạy)
bun run db:push      # đẩy thẳng schema vào DB (dev nhanh, bypass migration)
bun run db:studio    # mở Drizzle Studio quản trị DB
```

- Source of truth là `packages/db/src/schema.ts`; **migration SQL được commit**.
- API expose `GET /health/db` — ping `select 1` qua Drizzle, trả 503 nếu DB
  chưa cấu hình/không kết nối được. Chi tiết lỗi DB chỉ log phía server,
  không trả về client.

## Quy ước kỹ thuật

- **Bun phiên bản**: pin 1.4.3 tại `.bun-version` (CI dùng) — **phải khớp**
  tag `oven/bun:1.4.3` trong `docker/*.Dockerfile`. Đổi Bun = sửa đồng thời
  cả 3 file.
- Chuẩn coding, ownership (CODEOWNERS), Definition of Done, quality gates:
  xem `docs/ENGINEERING.md`. PR đụng cả 2 domain (web + api/db) phải có
  nhãn `cross-domain` + đồng thuận cả 2 owner.
- Quy trình branch/commit/PR: xem `CONTRIBUTING.md`.
- Quy tắc cho AI agent (OpenCode/Codex/T3 Code): xem `AGENTS.md` +
  `.agents/skills/`.
- `DATABASE_URL`: `.env` host dùng `localhost:5433` (port compose host);
  container API tự dựng URL nội bộ qua `POSTGRES_*` (không interpolate từ
  host) — xem `compose.yaml`.
- `next build` có thể tự ghi đè `apps/web/tsconfig.json` — **restore trước
  khi commit** (chi tiết: issue #40).
- Secrets chỉ qua dashboard (GitHub / Vercel / VPS) — **không bao giờ**
  nằm trong repo.

## Docker

```bash
cp .env.example .env   # điền giá trị local (KHÔNG commit .env)

docker compose up --build          # web + api + postgres
docker compose ps                  # kiểm tra healthcheck (healthy)
curl http://localhost:4000/health  # smoke test API
curl http://localhost:4000/health/db  # smoke test DB (qua Drizzle)
curl http://localhost:3000/        # smoke test Web
docker compose down                # tắt (thêm -v để xóa volume DB)
```

- Images multi-stage: builder chứa source + deps, runner chỉ chứa artifact.
- Secrets không nằm trong image — truyền runtime qua `.env` / `environment`.
- `postgres-data` là named volume thuộc riêng project này.

## Git & Branch workflow (Long & Văn)

Conventional Commits cho mọi commit/PR: `feat|fix|chore|docs|refactor|test|ci(scope): mô tả`.

```bash
# 1. Bắt đầu từ main mới nhất
git checkout main && git pull origin main

# 2. Tạo feature branch theo tên mình
git checkout -b feat/long-<ten-chuc-nang>     # ví dụ: feat/long-catalog-api
git checkout -b feat/van-<ten-chuc-nang>      # ví dụ: feat/van-auth-ui

# 3. Chạy gate trước khi commit (bun run verify — đỏ thì không tạo PR)

# 4. Commit nhỏ, rõ nghĩa
git commit -m "feat(web): add component grid page"

# 5. Push và tạo PR vào main (GHActions CI sẽ chạy, preview Vercel tự bật)
git push -u origin HEAD
gh pr create --base main --fill
```

Quy ước:

- **Không commit trực tiếp vào `main`.** Mọi thay đổi qua PR + review.
- CI phải xanh (lint, typecheck, build, docker) trước khi merge; PR mở
  chờ người review — bot chỉ tạo PR/response, không merge hộ.
- Nhánh prefix theo chủ Citadel: `feat/long-*`, `feat/van-*`
  (hoặc `fix/`, `chore/` tương ứng).

## CI (GitHub Actions)

`.github/workflows/ci.yml` — chạy khi push/PR vào `main`:

**Job quality** — `Lint / Typecheck / Test / Build` (required check)
1. Install dependencies (Bun 1.4.3 theo `.bun-version`, frozen lockfile)
2. Boundary checks (workspace imports — không cross-domain tự do)
3. Lint (Biome)
4. Typecheck (shared + api + web)
5. Test (bun test — smoke)
6. Build shared + api + web (Next.js)

**Job docker-runtime** — `Docker build & runtime smoke` (required check,
chạy sau job quality)
7. Validate Docker Compose (base + isolation overlay)
8. Compose isolation test (bằng chứng cleanup an toàn)
9. Compose up toàn stack thật + Docker runtime smoke + DB migration smoke
10. `compose down -v`

## CD & tự động hóa (GitHub Actions)

`.github/workflows/cd.yml` — chạy sau CI xanh trên `main`:

1. **GHCR**: publish image API (`ghcr.io/...`) — tự động qua `GITHUB_TOKEN`.
2. **DB migrate (production)**: chỉ chạy khi secret `PROD_DATABASE_URL`
   (Neon) tồn tại; **deploy không bao giờ chạy khi migrate đỏ**.
3. **Vercel Services**: cấu hình ở repo (`vercel.json`) — kích hoạt =
   import project 1 lần trên dashboard (runbook + trạng thái:
   `docs/DEPLOYMENT.md`); mỗi PR có preview deployment.
4. **VPS deploy**: gated bởi secrets `SSH_HOST/SSH_USER/SSH_KEY` — dùng khi
   cần host thứ hai cho API (ví dụ WebSocket chat).

Workflow phụ trợ:

- `owner-scope.yml` — chặn PR cross-domain thiếu nhãn `cross-domain`;
- `auto-assign-reviewers.yml` — tự request review owner còn lại;
- `auto-issue.yml` — CI/CD đỏ trên `main` ⇒ tự mở issue ghim chi tiết;
  xanh trở lại ⇒ tự comment + đóng.

Trạng thái CD chi tiết + runbook từng layer: `docs/DEPLOYMENT.md`.
