# Engineering Standards

Nguồn sự thật duy nhất cho coding standards, ownership và quality gates của repo.
Quy trình (branch/commit/PR) ở [`CONTRIBUTING.md`](../CONTRIBUTING.md); quy tắc agent ở [`AGENTS.md`](../AGENTS.md) — 3 file không lặp nội dung nhau.

## Phạm vi repo & nguyên tắc nền

- Repo là **monorepo skeleton Foundation** — chỉ setup nền tảng. **Chưa được phép thêm business logic** (marketplace, auth, payment) trừ khi có task riêng.
- Mỗi domain có chủ nhân. Sửa ngoài domain phải thống nhất với owner (map bên dưới) trước khi có code.
- Ưu tiên **nhỏ, đúng, đo được** hơn to, nhanh, "tạm chạy được".

## Ownership map

| Phạm vi | Owner (GitHub) |
|---|---|
| Toàn bộ repo (default code owner — xem `.github/CODEOWNERS`) | `NguyenTuMinhLong` |
| Database / `packages/db` (từ PR #1) | `DaoDungVan` |
| CI / Docker / workflow | `NguyenTuMinhLong` + `DaoDungVan` (both required) |
| API / auth / `apps/api` | `NguyenTuMinhLong` |
| Frontend / `apps/web` | `NguyenTuMinhLong` |

Việc bắt buộc review ở tầng GitHub được quản bằng **branch protection + CODEOWNERS**, không chỉ bằng docs.

## Coding standards

- **TypeScript strict toàn repo** (`tsconfig.base.json` — `strict`, `noUncheckedIndexedAccess`). Không tắt strict, không `any` trừ khi comment rõ lý do.
- **Lint**: Biome (`biome.json`) là formatter + linter duy nhất. Không thêm Prettier/ESLint song song. Format trước khi commit: `bun run lint:fix`.
- **Naming**: workspace package luôn có scope `@marketplace/*`; file test đặt cạnh module (`<module>.test.ts`).
- **Environment**: không có secrets trong code hay trong image. Container dựng env nội bộ qua compose (ví dụ `DATABASE_URL` của api container được build từ `POSTGRES_*`, không interpolate từ `.env` của host — xem `compose.yaml`).
- **Bun phiên bản**: pin chính xác ở 3 chỗ và phải khớp nhau — `.bun-version` (CI dùng qua `setup-bun`), và tag `oven/bun:<ver>` trong `docker/api.Dockerfile` + `docker/web.Dockerfile` (hiện là **1.4.3**). Đổi version = sửa đồng thời cả 3 trong 1 PR.

## Test

- Smoke test thật (bun:test), đặt cạnh module: `apps/api/src/index.test.ts`.
- Không chấp nhận test giả (`expect(true).toBe(true)`), test không assert gì, hoặc pass vô điều kiện.
- Runtime checks (compose, health endpoint) thuộc CI job `docker-runtime`, không viết lung tung vào unit test.

## Definition of Done — một PR "xong" khi

1. Phạm vi đúng như task đã thống nhất; diff không rò rỉ thay đổi ngoài phạm vi.
2. Tất cả quality gates dưới đây **PASS** trên máy dev (bằng chứng là output lệnh thật trong PR body).
3. CI xanh — bao gồm job `docker-runtime`.
4. Không secrets; `.env` không bị commit.
5. `docs/` và `README.md` không mâu thuẫn với code/CI thực tế.
6. Ít nhất 1 approval từ code owner (khi branch protection đã bật).

## Quality gates

| Gate | Lệnh | PASS khi |
|---|---|---|
| Lint | `bun run lint` | 0 lỗi 0 warning từ Biome |
| Typecheck | `bun run typecheck` | `tsc --noEmit` pass cho shared + api + web (test file không nằm trong tsc; được runtime kiểm khi `bun test`) |
| Test | `bun test` | 0 failed; test phải có assert thật |
| Build | `bun run build` | exit 0; artifact đúng vị trí `dist`/`.next` |
| Docker runtime | CI job `docker-runtime` | compose up healthy + `/health` & web `/` trả đúng contract |

Kết quả mỗi gate **chỉ được báo PASS / FAIL / UNVERIFIED** — không có "gần như" hay "chắc chắn pass".

## Phiên bản toolchain

| Tool | Nơi pin | Giá trị hiện tại |
|---|---|---|
| Bun | `.bun-version`, `docker/*.Dockerfile` | 1.4.3 |
| Node runtime cho Next image | `docker/web.Dockerfile` runner | `node:22-alpine` |
| PostgreSQL | `compose.yaml` | `postgres:17-alpine` |
