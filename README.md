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
│   └── PULL_REQUEST_TEMPLATE.md
├── compose.yaml
├── .dockerignore / .gitignore / .env.example
├── biome.json / tsconfig.base.json
└── package.json
```

## Scripts (chạy từ root)

```bash
bun install          # cài dependencies toàn monorepo

bun run dev:web      # Next.js dev server :3000
bun run dev:api      # Bun API dev (hot reload) :4000, health DB: /health/db

bun run build        # build shared → db → api → web
bun run typecheck    # tsc --noEmit (shared + db + api; web typecheck chạy trong next build)
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
- API expose `GET /health/db` — ping `select 1` qua Drizzle, trả 503 nếu DB chưa cấu hình/không kết nối được.

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

1. Install dependencies (Bun, frozen lockfile)
2. Lint (Biome)
3. Typecheck
4. Build shared + api + web
5. Validate Docker Compose (`docker compose config -q`)
6. Build 2 Docker images (không push)

Chưa có CD production: chưa push images, chưa deploy Vercel.
