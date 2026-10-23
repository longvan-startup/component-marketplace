# Deployment & CD — Thiết kế (chưa kích hoạt)

> File này là **kế hoạch**, chưa có deployment nào được cấu hình tự động.
> Mọi phần "kích hoạt" đều phải qua mục **Checklist kích hoạt** và sự xác nhận của repo owner.

## Trạng thái đã kiểm chứng (2026-10-22, bằng lệnh thật — không phải ước đoán)

| Hạng mục | Kết quả | Cách kiểm |
|---|---|---|
| GitHub repo secrets | **0** | `gh api repos/.../actions/secrets` |
| GitHub Environments | **[]** (không có) | `gh api repos/.../environments` |
| CD workflow | **Không tồn tại** (CI có 1 workflow: `ci.yml`) | `ls .github/workflows/` |
| Deploy tooling trên máy | **Không có** (vercel/railway/fly/wrangler đều vắng) | `which ...` |
| Token GitHub đang dùng | scopes: `gist, read:org, repo, workflow` — **không đủ** auth provider nào | `gh auth status` |
| Hosting targets | Chưa xác minh Vercel / Mắt Bão VPS | chưa có credential nào |
| Branch protection `main` | Đã enforce (2 status checks + 1 approval + admin enforced) | `gh api .../branches/main/protection` |

**Kết luận: không cấu hình deployment trong PR này.** Chỉ tài liệu hoá quyết định cần
mục tiêu + quyền, sau đó mới dần bật từng phần.

## Mục tiêu môi trường

| Môi trường | Web (Next.js) | API (Bun + Express) | PostgreSQL |
|---|---|---|---|
| dev (máy) | `next dev` | `bun run dev:api` | Docker compose (`postgres:17`) |
| preview (theo PR) | **Vercel Preview** — tự sinh cho mọi PR | chưa có preview riêng | Neon branch (khi Neon được cấu hình) |
| production | **Vercel** — manual approval | **VPS (Mắt Bão)** hoặc platform — cần xác minh trước | **Neon** (PITR) khi cấu hình |

## 1. Web — Next.js trên Vercel

- Preview: Vercel sẽ tự tạo deployment cho mọi PR (dùng GitHub App của Vercel, KHÔNG cần
  tự viết workflow) — comment URL preview vào PR.
- Production: **không auto-deploy từ `main`**. Chỉ promote/deploy production sau khi
  owner nhấn duyệt — hoặc bật GitHub Environment `production` với `required reviewers`.
- Điều kiện kích hoạt: (a) tài khoản/token Vercel hợp lệ, (b) connect repo,
  (c) đặt env trong dashboard Vercel (xem Secrets bên dưới), (d) quyết định domain/DNS.
- **Chưa làm** vì chưa verify: token/CLI Vercel không tồn tại trên máy (`which vercel` rỗng),
  không thể kiểm quyền.

## 2. API — Bun + Express

- **Chưa chốt hosting** — phải xác minh trước khi triển khai:
  - Phương án A — VPS Mắt Bão (đã ghi hướng đi này trong org profile): cần verify
    SSH + Docker trên server, reverse proxy (Caddy/Nginx) + TLS, firewall.
  - Phương án B — platform (Railway/Fly/Render): cần token + lịch sử billing.
- Image đã sẵn sàng làm deploy artifact: `docker/api.Dockerfile` multi-stage,
  pin `oven/bun:1.4.3`, được CI job `docker-runtime` build + smoke mỗi PR.
- Khi chốt: publish image lên **GHCR theo tag git SHA**, deploy bằng `docker compose`
  trên server hoặc platform — **không build trên server**.
- Contract dùng cho deployment/healthcheck: `GET /health` (và `/health/db` sau khi
  PR #1 đã merge — trả 503 nếu DB chưa cấu hình, không crash).

## 3. PostgreSQL

- Local/dev: Docker compose (đã có, healthcheck sẵn).
- Cloud: **Neon** khi được cấu hình — `DATABASE_URL` sửa qua secrets; host-side
  dùng port compose 5433 như hiện tại, production dùng connection string Neon.
- Migration: chỉ chạy Drizzle migration **tăng dần** (`bun run db:migrate` từ
  `packages/db` — PR #1). Migration destructive (drop/rename) phải plan rollout
  2 pha — xem Rollback.

## 4. Secrets & quyền truy cập

- Không commit secrets: `.env` đã nằm trong `.gitignore`; dockerfile không COPY secrets;
  compose tự dựng URL nội bộ cho container API qua `POSTGRES_*` (đã có enforcement
  trong compose.yaml).
- Nguồn sự thật cho secrets khi kích hoạt:
  - GitHub Environments: `production` (+ `preview` nếu cần) — user `NguyenTuMinhLong`
    (admin) tạo được; hiện 0 secrets.
  - Vercel: env trong dashboard (không qua GitHub secrets cho provider riêng).
- Token GitHub hiện tại của máy không đủ quyền cho deploy tự động — cần thêm scope
  hoặc token riêng cho từng provider.

## 5. Rollback (khi deployment thất bại)

| Layer | Cách rollback |
|---|---|
| Web | Vercel **Instant Rollback** — mốc deployment immutable; rollback trong 1 click |
| API (container) | Image pin **theo git SHA** → `docker compose down` + ref image SHA cũ; giữ code cũ cùng migration nếu migration chỉ-add |
| Migration DB | chỉ-add migration thường KHÔNG cần rollback (code cũ vẫn chạy); migration destructive → plan 2 pha + Neon **point-in-time restore**/branch về trước lỗi |
| Compose volume local | `docker compose down -v` (xoá sạch dữ liệu dev — dùng khi volume lỗi, không rollback production) |

## Checklist kích hoạt (chỉ làm khi có xác nhận của owner)

1. **Vercel**: tạo tài khoản/token → `vercel whoami` PASS → connect repo,
   import env → bật Preview cho PR.
2. **API hosting**: chọn phương án + verify credential (SSH/token) → publish GHCR tag
   theo SHA → deploy script/manifest tách riêng (không dùng CI để deploy production).
3. **GitHub Environments**: tạo `production` + bật `required reviewers` + đặt secrets.
4. **Migrations trong CD**: chỉ chạy `db:migrate` trước deploy API khi code mới có
   migration; rollback code cũ + migration mới chỉ-add là an toàn (backward-compatible).
5. Mọi thay đổi sau điểm này phải cập nhật lại trạng thái kiểm chứng ở đầu file
   (kèm lệnh + ngày) — giữ file này làm source of truth cho CD.
