# Agent Learnings

Log kèm theo (append-only) các sai lầm THẬT của AI agent khi làm việc trong `component-marketplace`, nguyên nhân sinh ra, và cách khắc phục — để agent kế tiếp không lặp lại.

- Đây là **ghi chú sự cố theo ngày**, không phải bản sao của `AGENTS.md` / `CONTRIBUTING.md`.
- Các file đó chứa luật đứng; file này là lý lịch sự việc.

## Cách dùng file này

- **Trước task không-trivial**: đọc lướt các entry liên quan tới vùng sắp đụng (`packages/db`, `apps/api`, `apps/web`, docs, CI/tooling).
- **Sau khi một sai lầm THỰC TẾ xảy ra** (review bắt được, check fail, phải revert, giả định sai khiến redo): **append** một entry trước khi kết thúc task. Chỉ ghi những gì thực sự xảy ra trong repo này, không pre-populate hư cấu.
- Append-only: entry lạc hậu (do code đã đổi) thì thêm dòng `Superseded:` dưới entry thay vì xóa.

## Định dạng entry

```md
### YYYY-MM-DD — Tiêu đề ngắn

- **Pattern:** điều gì phía trên dẫn tới sai lầm
- **Điều gì sai:** sự việc
- **Fix:** đã sửa thế nào (commit/PR nếu có)
- **Phòng:** cách làm đúng từ đầu lần sau
```

## Các entry

### 2026-10-21 — Docker `bun install --frozen-lockfile` chết nếu thiếu manifest của một workspace

- **Pattern:** `bun.lock` ở root liệt kê workspace `@marketplace/db`, nhưng Dockerfile chỉ COPY `apps/api` + `packages/shared`.
- **Điều gì sai:** image API fail ở stage deps: "workspace @marketplace/api depends on workspace @marketplace/db, which is listed in bun.lock but not on disk".
- **Fix:** COPY `packages/db/package.json` vào stage deps của cả 2 Dockerfile; COPY nguyên `packages/db` vào builder + runner của API (commit `bfb56db`, CI Docker job PASS lại).
- **Phòng:** thêm workspace mới → kiểm tra ngay cả 2 Dockerfile trong `docker/` COPY đủ manifest cho stage deps.

### 2026-10-21 — `ReturnType<typeof>` trên `drizzle(...)` gây circular type

- **Pattern:** khai báo `type Database = ReturnType<typeof createDb>` trong khi `createDb` return `drizzle(client, { schema })`.
- **Điều gì sai:** `tsc --noEmit` bắn "Type alias 'Database' circularly references itself".
- **Fix:** dùng `PostgresJsDatabase<typeof schema>` từ `drizzle-orm/postgres-js` và khai báo type tường minh (`packages/db/src/index.ts`).
- **Phòng:** không dùng `ReturnType<>` trên kết quả generic `drizzle(...)` với schema param; khai báo trực tiếp kiểu của adapter.

### 2026-10-22 — drizzle-kit ghi meta JSON theo format khác Biome, gate lint đỏ mỗi lần generate

- **Pattern:** `bun run db:generate` sinh `packages/db/drizzle/meta/*.json` với mảng đa dòng, Biome muốn một dòng.
- **Điều gì sai:** `bun run lint` đỏ sau hầu như mọi lần generate.
- **Fix tạm:** `bun run lint:fix` trước commit. Đề xuất lâu dài: ignore `packages/db/drizzle/` trong `biome.json` — đã mở issue #16 chờ cả hai owner tooling duyệt.
- **Phòng:** sau `db:generate` chạy luôn `bun run lint:fix`.

### 2026-10-22 — WSL2 mirrored networking: curl từ host không trả lời đúng process của repo

- **Pattern:** sau `docker compose up`, `curl http://localhost:3000/` từ WSL host trả HTTP 307 redirect `/vi` kèm cookie `NEXT_LOCALE` — một kiểu middleware mà repo không có.
- **Điều gì sai:** tưởng web app repo có i18n middleware rồi đi soi nhầm cấu hình.
- **Fix:** probe từ trong container (`docker compose exec web wget -qO- http://127.0.0.1:3000/`) — web trả đúng nội dung "Component Marketplace". Port 3000 phía host bị một process bên Windows chiếm (mirrored networking). `scripts/verify.sh --docker` dùng exec-based probe chính vì lý do này.
- **Phòng:** khi nghĩ app lỗi qua "localhost", xác minh process bằng probe trong container trước; không dùng host port để chẩn đoán app của repo.
