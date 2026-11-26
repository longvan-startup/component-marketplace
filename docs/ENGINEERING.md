# Engineering Standards

Nguồn sự thật duy nhất cho coding standards, ownership và quality gates của repo.
Quy trình (branch/commit/PR) ở [`CONTRIBUTING.md`](../CONTRIBUTING.md); quy tắc agent ở [`AGENTS.md`](../AGENTS.md) — 3 file không lặp nội dung nhau.

## Phạm vi repo & nguyên tắc nền

- Repo gồm `apps/web`, `apps/mobile`, `apps/api`, `packages/shared`, và `packages/db`. Phạm vi sản phẩm nằm ở [`PRODUCT.md`](PRODUCT.md). RFC đang ghi PENDING REVIEW chưa phải tính năng được duyệt.
- Mỗi domain có chủ nhân. Sửa ngoài domain phải thống nhất với owner (map bên dưới) trước khi có code.
- Ưu tiên **nhỏ, đúng, đo được** hơn to, nhanh, "tạm chạy được".

## Ownership map

| Phạm vi | Owner (GitHub) | Vai |
|---|---|---|
| Toàn bộ repo + Backend (apps/api, auth, `packages/db`, `packages/shared`) — default code owner | `NguyenTuMinhLong` | Backend/AI |
| Frontend (`apps/web`, `apps/mobile`) | `DaoDungVan` | Frontend/AI |
| CI / Docker / infra / `scripts/` | `NguyenTuMinhLong` + `DaoDungVan` | both required |

Việc bắt buộc review ở tầng GitHub được quản bằng **branch protection + CODEOWNERS**, không chỉ bằng docs.

## Coding standards

- **TypeScript strict toàn repo** (`tsconfig.base.json` — `strict`, `noUncheckedIndexedAccess`). Không tắt strict, không `any` trừ khi comment rõ lý do.
- **Lint**: Biome (`biome.json`) là formatter + linter duy nhất. Không thêm Prettier/ESLint song song. Format trước khi commit: `bun run lint:fix`.
- **Line endings**: `.gitattributes` chuẩn hóa file text thành LF khi checkout trên mọi hệ điều hành; các định dạng binary được giữ nguyên. `.editorconfig` hướng dẫn editor dùng LF.
- **Naming**: workspace package luôn có scope `@marketplace/*`; file test đặt cạnh module (`<module>.test.ts`).
- **Environment**: không có secrets trong code hay trong image. Container dựng env nội bộ qua compose (ví dụ `DATABASE_URL` của api container được build từ `POSTGRES_*`, không interpolate từ `.env` của host — xem `compose.yaml`).
- **Bun phiên bản**: pin chính xác ở 3 chỗ và phải khớp nhau — `.bun-version` (CI dùng qua `setup-bun`), và tag `oven/bun:<ver>` trong `docker/api.Dockerfile` + `docker/web.Dockerfile` (hiện là **1.4.3**). Đổi version = sửa đồng thời cả 3 trong 1 PR.

## Cấu trúc thư mục và kích thước file

Áp dụng cho mọi người và mọi AI agent, ở mọi domain.

- **Chia theo chức năng**, không theo loại file. Thứ được từ hai vùng trở lên dùng thì đặt ở thư mục chung của domain (web: `components/ui/`, `components/effects/`), không để vùng này import ruột của vùng kia.
- **File mới tối đa 200 dòng** (không tính test). File mới vượt thì tách theo trách nhiệm trước khi merge: giao diện, hook hoặc logic điều khiển, hàm thuần có test.
- **File đang vượt 200 dòng được giữ nguyên, nhưng không được dài thêm.** Thêm hành vi vào file đó thì đặt phần mới ở file riêng. Chỉ tách file cũ khi đang sửa đúng phần đó hoặc có task tách riêng.
- **Thư mục tối đa 10 file nguồn** (không tính test). Đầy thì chia thư mục con theo chức năng trước khi thêm file. Ngoại lệ: thư mục primitive phẳng như `components/ui/`.
- **Không tạo thư mục chỉ để chứa một file**, và không đặt tên chung chung như `misc/`, `helpers/`, `common2/`.
- **Tìm trước khi tạo:** có component hay hàm làm được việc đó thì dùng lại hoặc mở rộng.
- **Di chuyển file là thay đổi riêng:** dùng `git mv`, chỉ sửa đường dẫn, không đổi hành vi trong cùng commit. Cập nhật bảng cấu trúc trong `AGENTS.md` của domain ở cùng PR.
- Giữ một file vượt giới hạn thì ghi lý do trong PR.

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

Run the full set of gates (excluding Docker runtime) with a single command:
`bun run verify` (`scripts/verify.sh` — add `--docker` to include the compose
runtime smoke layer).

| Gate | Command | PASS when |
|---|---|---|
| Lint | `bun run lint` | 0 errors, 0 warnings from Biome |
| Boundary | `bun run boundary` | 0 cross-workspace imports (web/mobile→DB/api, api→web/mobile, shared→internal deps, db→apps or other @marketplace packages) |
| Typecheck | `bun run typecheck` | `tsc --noEmit` passes for shared + db + api + web + mobile (test files are excluded from tsc; checked at runtime by `bun test`). Mobile is not part of `bun run build`; store binaries stay out of this gate |
| Test | `bun test` | 0 failures; tests must contain real assertions |
| Build | `bun run build` | exit 0; artifacts in the expected `dist`/`.next` paths |
| Docker runtime | CI job `docker-runtime` — or `bun run verify --docker` locally | compose runs inside an **isolated project** `cmp-verify-*` (no host ports published) + in-container probes `/health`, `/health/db` (`= connected`), web `/`, and catalog list/detail responses after migration on a blank database; `users`/`components` tables exist and repeated migration is a no-op |

Docker isolation (mandatory — see `scripts/docker-smoke.lib.sh`): smoke runs must
NEVER use the development Compose project; the `down -v` cleanup only touches
resources labeled with the verify project (proven by
`scripts/test-compose-isolation.sh`). `bun run verify --docker-only` skips the
host gates and is used by CI parity runs only.

Kết quả mỗi gate **chỉ được báo PASS / FAIL / UNVERIFIED** — không có "gần như" hay "chắc chắn pass".

## Phiên bản toolchain

| Tool | Nơi pin | Giá trị hiện tại |
|---|---|---|
| Bun | `.bun-version`, `docker/*.Dockerfile` | 1.4.3 |
| Node runtime cho Next image | `docker/web.Dockerfile` runner | `node:22-alpine` |
| PostgreSQL | `compose.yaml` and the CI quality service | `postgres:17-alpine` |
