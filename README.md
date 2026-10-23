# Component Marketplace

Monorepo skeleton (Foundation) — chỉ setup nền tảng, Docker, CI/CD. **Chưa có business logic.**

## Stack

| Lĩnh vực | Công nghệ |
|---|---|
| Monorepo | Bun Workspaces |
| Frontend | Next.js + TypeScript (strict) |
| Backend | Bun + Express + TypeScript |
| Database | PostgreSQL / Neon (production) |
| ORM | Drizzle ORM (`@marketplace/db`, migrations, postgres.js) |
| Lint | Biome |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Hosting | Vercel (web), sau này Mắt Bão VPS |

**Tích hợp sau** (chưa cài dependency, chỉ ghi nhận): Better Auth,
Motion + GSAP, Lemon Squeezy, Cloudflare R2, Expo (mobile),
Playwright + Gemini (AI Factory).

## Cấu trúc

```text
component-marketplace/
├── apps/
│   ├── web/        # Next.js (port 3000)
│   └── api/        # Bun + Express (port 4000, health: /health)
├── packages/
│   ├── shared/     # constants/util dùng chung (@marketplace/shared)
│   └── db/         # Drizzle ORM: schema + client (@marketplace/db)
│       ├── src/schema.ts     # bảng users, components
│       ├── src/index.ts      # createDb client factory
│       └── drizzle/          # migrations SQL (được commit)
├── docker/
│   ├── web.Dockerfile
│   └── api.Dockerfile
├── .github/
│   ├── workflows/ci.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── compose.yaml
├── .dockerignore / .gitignore / .env.example
├── biome.json / tsconfig.base.json
├── AGENTS.md / CONTRIBUTING.md / docs/ENGINEERING.md
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
```

## Database (Drizzle ORM)

Workspace `packages/db` (`@marketplace/db`) — schema + client dùng chung:

```bash
bun run db:generate  # sinh migration từ schema.ts (packages/db/drizzle/*.sql)
bun run db:migrate   # áp migration vào DB (cần DATABASE_URL / postgres compose đang chạy)
bun run db:push      # đẩy thẳng schema vào DB (dev nhanh, bypass migration)
bun run db:studio    # mở Drizzle Studio quản trị DB
```

- Source of truth là `packages/db/src/schema.ts`; **migration SQL được commit**.
- API expose `GET /health/db` — ping `select 1` qua Drizzle, trả 503 nếu DB chưa cấu hình/không kết nối được. Chi tiết lỗi DB chỉ log phía server, không trả về client.

## Quy ước kỹ thuật

- **Bun phiên bản**: pin 1.4.3 tại `.bun-version` (CI dùng) — **phải khớp** tag `oven/bun:1.4.3` trong `docker/*.Dockerfile`. Đổi Bun = sửa đồng thời cả 3 file.
- Chuẩn coding, ownership, Definition of Done, quality gates: xem `docs/ENGINEERING.md`.
- Quy trình branch/commit/PR: xem `CONTRIBUTING.md`.
- Quy tắc cho AI agent (OpenCode/Codex/T3 Code): xem `AGENTS.md`.
- `DATABASE_URL`: `.env` host dùng `localhost:5433` (port compose host); container API tự dựng URL nội bộ qua `POSTGRES_*` (không interpolate từ host) — xem `compose.yaml`.

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
git checkout -b feat/long-<ten-chuc-nang>     # ví dụ: feat/long-marketplace-ui
git checkout -b feat/van-<ten-chuc-nang>      # ví dụ: feat/van-auth-api

# 3. Commit nhỏ, rõ nghĩa
git commit -m "feat(web): add component grid page"

# 4. Push và tạo PR vào main (GHActions CI sẽ chạy)
git push -u origin HEAD
gh pr create --base main --fill
```

Quy ước:

- **Không commit trực tiếp vào `main`.** Mọi thay đổi qua PR + review.
- CI phải xanh (lint, typecheck, build, docker) trước khi merge.
- Nhánh prefix theo chủ Citadel: `feat/long-*`, `feat/van-*`
  (hoặc `fix/`, `chore/` tương ứng).

## CI (GitHub Actions)

`.github/workflows/ci.yml` — chạy khi push/PR vào `main`:

**Job quality**
1. Install dependencies (Bun 1.4.3 theo `.bun-version`, frozen lockfile)
2. Lint (Biome)
3. Typecheck (shared + api + web)
4. Test (bun test — API smoke)
5. Build shared + api + web

**Job docker-runtime** (chạy sau job quality)
6. Validate Docker Compose (`docker compose config -q`)
7. Compose up toàn stack thật (kèm build 2 image)
8. Assert runtime: `GET :4000/health` → `"status":"ok"`, `GET :3000/` → nội dung web
9. `compose down -v`

Chưa có CD production: chưa push images, chưa deploy Vercel.
