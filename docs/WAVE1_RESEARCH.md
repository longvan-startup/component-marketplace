# Nghiên cứu Wave-1 — quyết định và trạng thái triển khai

Nghiên cứu ban đầu được ghi ngày 2026-10-26 để rà các quyết định trước khi
triển khai. Từ đó các phần việc #33, #29, #31 đã được merge; #41 đã chốt Option A;
phần live wiring còn lại của #32 đã tách thành issue #56. Vì vậy nội dung bên
dưới giữ lại baseline ban đầu nhưng đánh dấu rõ phần đã hoàn thành và phần còn
mở, thay vì coi toàn bộ D1–D7 là câu hỏi chưa được giải quyết.

Trạng thái cập nhật: **#33/#29/#31/#41 hoàn tất; #56 còn mở**
(cập nhật cuối: 2026-10-28).

| Hạng mục | Trạng thái hiện tại | Bằng chứng |
|---|---|---|
| #33 — đồng bộ TypeScript | Hoàn tất; `^7.0.2` được dùng thống nhất | PR #59; issue #33 đã đóng |
| #29 — API bootstrap | Hoàn tất qua PR #55; logging triển khai dạng text một dòng, không phải JSON như đề xuất ban đầu | `apps/api/src/index.ts`; issue #29 đã đóng |
| #31 — catalog read endpoints | Hoàn tất qua PR #58; detail dùng `:slug` | `apps/api/src/catalog/`; issue #31 đã đóng |
| #41 — nguồn của `summary` | Hoàn tất: Option A, derive trong API mapper; không cần migration | PR #58 và quyết định tại issue #41 |
| #32 — web data layer | acceptance ban đầu hoàn tất qua #38/#39/#46; live wiring tách sang #56 | issue #32 đóng; issue #56 còn mở |

## Thứ tự code khuyên dùng tại thời điểm nghiên cứu

```text
#33 deps unify (khóa phần — làm TRƯỚC, tránh bun.lock xung đột liên quan)
   → #29 api bootstrap (móng cho mọi endpoint)
      → D2 (tài liệu này quyết #41)
         → #31 endpoints catalog (Long)
            → #32 live wiring web (Văn)   ← bước docs song song được với #31
```

Đây là thứ tự ban đầu, không phải kế hoạch còn chờ bắt đầu: #33, #29, quyết
định #41 và #31 đã hoàn tất; phần web live-wiring hiện được theo dõi ở #56.

#17 (Better Auth) là wave sau — KHÔNG thuộc Wave-1, study riêng khi tới
(§ Rủi ro cuối tài liệu).

---

# A. #33 — Đồng bộ version các workspaces

**Trạng thái hiện tại: hoàn tất qua PR #59; issue #33 đã đóng.** Bảng dưới là
baseline đo ngày 2026-10-26 trước khi PR #59 đồng bộ TypeScript.

## Hiện trạng thực đo được (issue #33 viết theo lũy cũ)

Dữ liệu thật từ `bun.lock` + manifests (2026-10-26):

| Gói | Manifest các workspace | Thực tế trong `bun.lock` |
|---|---|---|
| typescript | root / shared / api / web `^7.0.2` — **db `^5.9.3`** | hai version (cần kiểm tra lại khi regen) |
| express | api `^5.1.0` | **một** `express@5.3.0` duy nhất |
| react / react-dom | web `^19.2.0` | **một** `react@19.3.1`, `react-dom@19.3.1` |
| zod | `^4` (shared — contracts) | **một** `zod@4.6.7` |

⇒ React / express / zod **không có duplicate nào thực sự trong lock** —
cụm "react 19.3.0 vs 19.3.1" và "express 5.0.6 vs 5.3.0" trong issue #33 đã
lỗi thời. Mismatch khi đó còn lại duy nhất: **TypeScript 7.0.2 (4 workspace)
vs 5.9.3 (db)**. PR #59 sau đó thống nhất TypeScript `^7.0.2` trên các
workspaces; issue #33 ghi nhận PR đã merge, Biome vẫn pin `2.5.15`, và local
verify cùng CI đều pass.

## D1 — quyết định ban đầu và kết quả

Đề xuất ban đầu là thống nhất `^7.0.2` và bỏ `5.9.3` ở `packages/db`.
PR #59 đã triển khai quyết định đó; không cần fallback hay quyết định D1 bổ sung.

---

# B. #29 — API bootstrap layer

**Trạng thái hiện tại: hoàn tất qua PR #55; issue #29 đã đóng.** Các nhận định
và lựa chọn dưới đây mô tả baseline trước PR #55. Implementation hiện có env
validation, error envelope, exact-match CORS allowlist, request logging và
graceful shutdown (`server.close()` rồi `db.close()`). Logging thực tế là text
một dòng có method/path/status/duration, không phải JSON như đề xuất bên dưới.

## Baseline trước PR #55 (`apps/api/src/index.ts` — đọc ngày 2026-10-26)

- 1 file: `express.json()` + lazy `getDb()` + 3 route (`/`, `/health`,
  `/health/db`) + dual mount `/api` cho Vercel (#46) + default export cho
  framework preset Express — phần mount/health **giữ nguyên không đụng**.
- Chưa có: env validation, error middleware, request logging, CORS,
  graceful shutdown **đủ điều kiện nhưng chưa `pool.end()`** khi SIGTERM
  (hiện chỉ `server.close()`).
- **Khe hở nhỏ đã đo được**: `createDb()` của `packages/db` **không trả giữ
  SQL client** → muốn `pool.end()` trong shutdown phải chỉnh một đoạn nhỏ
  `packages/db` (thêm handle `createDbHandle(url) → { db, close() }` hoặc
  giữ client trong module scope). Chỉnh này thuộc domain **Long**, ví lý do
  trong PR #29; các import hiện tại (`createDb`, `Database`) giữ nguyên để
  boundary không thay đổi.

## Đề xuất tại thời điểm nghiên cứu (trước PR #55; lịch sử, không phải thiết kế hiện tại)

1. **Env validation — zod, fail-fast**: `envSchema` đặt trong `apps/api`
   (env là chuyện của từng app — **không** đưa lên `packages/shared`).
   Validate: `PORT` (default 4000), `NODE_ENV` (Vercel set sẵn — chỉ validate),
   `DATABASE_URL` (giữ hành vi hiện tại: thiếu ⇒ `/health` vẫn OK nhưng
   `/health/db` 503 degraded — compose/Vercel không chết; chỉ bật thêm 1 dòng
   WARN), tùy chọn `CORS_ORIGINS` (CSV). Env sai ⇒ `exit 1` + log chỉ ra
   chính xác biến nào sai — ứng dụng không được boot khi config lởm.

2. **Error middleware — dùng chính `apiErrorSchema`** (đã có ở shared):
   mọi response lỗi đi qua một mapper duy nhất, không tự nghĩ shape mới.
   Stack trace chỉ dev (`NODE_ENV !== 'production'`).

3. **Logging — console JSON 1 dòng, không thêm dependency** (không pino):
   `{"req":"GET","path":"/components","status":200,"ms":12}`; **bỏ qua
   `/health*`** (tránh spam smoke/probe). Lý do: team 2 người, Vercel tự
   capture stdout; nâng cấp lên pino/OpenTelemetry là công việc của một PR
   kế tiếp khi cần vận hành thực sự — không lệ polarization ($0 → mức nhỏ).

4. **CORS — không cài package `cors`**: set `Access-Control-Allow-Origin`
   tính từ `CORS_ORIGINS` (split CSV, exact match), chỉ khi match đủ.
   Production same-origin (`/api/*` cùng domain trên Vercel) **không cần
   CORS từ chính nó** — browser tự same-origin. Wave-1 chỉ `GET`.

5. **Graceful shutdown**: dùng handle mới ở trên để `pool.end()`; SIGTERM
   lần đầu = graceful, lần thứ 2 trong 5s = force exit (Vercel có kỳ hạn
   shutdown riêng — logic này chỉ ảnh hưởng Docker/VPS).

---

# C. #31 — Read endpoints catalog và quyết định #41

**Trạng thái hiện tại: endpoints hoàn tất qua PR #58; issue #31 và #41 đã
đóng.** #41 chọn Option A: API mapper trim `description`, dùng `name` khi
description null/blank, rồi derive `summary` tối đa 300 ký tự. Không có
database migration cho `summary`. Các bảng và tiêu chí bên dưới là baseline
nghiên cứu; chúng không còn là blockers của #31.

## Khoảng cách Contract ↔ DB (bảng kiểm đọc thật từng field — rủi ro lớn nhất Wave-1)

| Field hợp đồng (`componentSchema`) | DB schema thật (`components`) | Khoảng cách | Đề xuất Wave-1 |
|---|---|---|---|
| `summary` (required, ≤300) | **KHÔNG có cột** | #41 đã giải quyết | Derive ở mapper theo Option A; fallback sang `name` khi description rỗng |
| `description` (required, ≥1) | `text NULL` | nullable vs required | Migrate: `NOT NULL DEFAULT ''` + mapper không fallback ngầm |
| `category` (enum 3 giá trị) | `text DEFAULT 'general'` | `'general'` nằm ngoài hợp đồng enum | Migrate: default → `'react-component'` + check constraint; map các row `general` cũ khi migrate |
| `author` (handle string ≥2) | `authorId` uuid FK | khác kiểu | Join `users` lấy `name` (handle v1 = name); `author_id NULL` ⇒ `'anonymous'` (ghi chú rõ trong mapper) |
| `id / slug / name / tags / latestVersion / isPublished` | khớp | — | — |
| `isPublished = false` | có | public list **chỉ hiện published** | SQL `WHERE is_published = true` cho list **và** detail (404 khi chưa publish) |

## D2 — quyết định #41: **Option A — derive server-side**

PR #58 triển khai Option A và issue #41 ghi nhận quyết định này: trim
`description`, fallback sang `name` nếu null/blank, cắt `summary` theo giới
hạn 300 ký tự của shared contract, rồi validate bằng `componentSchema.parse()`.
Không cần migration. Chỉ mở lại Option B nếu có yêu cầu thực tế cho teaser do
creator tự viết, khác với `description`.

## Endpoints đã triển khai trong PR #58

- `GET /components` — query qua `listRequestSchema` (zod parse; sai ⇒ 422
  theo `apiErrorSchema`). **Detail dùng `:slug`**: issue #31 ban đầu ghi
  `:id`, nhưng hợp đồng #39 và route được triển khai trong PR #58 dùng
  `GET /components/:slug` (id giữ internal).
- SQL: `limit/offset` (wave-1); sort `newest` = `created_at DESC`, `name` =
  `name ASC`; filter nhỏ nhất: `q` = `name ILIKE` + overlap tags,
  `category` exact — chính là "smallest useful set" issue #31 yêu cầu, ghi
  lựa chọn vào README của api. Skip keyset pagination đến lúc pageSize lớn
  cho thấy cần.
- Public surface trên Vercel = `/api/components…` (dual mount đã dựng #46);
  internal binding calls vẫn dùng path gốc.

## Tích hợp test trong PR #58

- Pattern disposable Postgres: tái dùng `scripts/docker-smoke.lib.sh` + compose
  overlay (nền đã có từ #30/#34); điểm mới: **assert response qua
  `listResponseSchema`** (không tự do đoán field) + case 404 (slug miss) +
  422 (pageSize 999) + empty page.

PR #58 đã triển khai list/detail và integration coverage cho response, empty
page, 404, invalid query và unpublished rows. Một khoảng cách vẫn còn được
giữ rõ trong mapper: DB default `category = 'general'` không thuộc enum của
shared contract, nên mapper fail loud thay vì âm thầm remap. Row có category
`general` cần được chuẩn hóa hoặc xử lý có chủ đích trước khi mapper có thể
trả DTO công khai hợp lệ.

---

# D. #56 — Web data layer **live** (wiring, tách từ #32)

Issue #32 đóng sau khi acceptance ban đầu được giao qua #38/#39/#46. Phần
live-wiring bên dưới được tách thành issue #56, hiện còn mở và được giao cho
Văn.

## Phần ĐÃ xong (từ #38/#39 — đừng làm lại)

App shell, tokens Tailwind `@theme`, mock/live switch (`API_MODE`),
`api-client` + quy tắc base URL theo runtime, UI primitives, render catalog
RSC, smoke marker `data-smoke`.

## Phần còn lại theo issue #56

1. **Types chuyển sang `@marketplace/shared`**: `catalog-source.ts` hiện giữ
   **bản local type copy** (`CatalogItem`, các shape query) dù hợp đồng đã
   merge từ #39 — hành động: xóa local copies + import `z.infer` types từ
   `packages/shared/src/contracts`. Bản thân file vẫn ghi "STILL A PROPOSAL"
   trong header (lỗi thời) — cập nhật cả docstring.
2. **Parse runtime output**: `apiFetchJson` + validate từng response qua
   `listResponseSchema` / `detailResponseSchema` / `apiErrorSchema` ngay
   trong `catalog-source` — sai shape ⇒ lỗi có giá trị (code + status), không
   để data lởm trôi vào UI.
3. **Error/loading states**: `ApiClientError` (code) → UI việt hoá (VN strings
   gom 1 file constants cho i18n sau); trang list + detail; mock mode cũng
   phải chạy đủ cả 3 trạng thái.
4. **Cache strategy — quyết nhỏ**:
   - fetch mặc định của Next 16 (app router) là **uncached** — rõ ràng
     ghi nhận; đề xuất **`revalidate = 60`** cho route list + detail live
     (giảm tải Neon, chấp nhận stale 60s); mock mode không cache dư.
   - **React Query: KHÔNG** (RSC-first + client islands ít — thêm lib chỉ
     tăng bundle); ghi lý do như issue #32 yêu cầu vào `apps/web/AGENTS.md`.
5. **Docs**: cập nhật `apps/web/AGENTS.md` data rule khi bật live (single
   accessor vẫn đúng — chỉ adapter đổi).

## Tiêu chí hoàn thành

- [ ] Mock + live đều chạy cả list & detail end-to-end; không còn local
      type copy nào.
- [ ] Error envelope map đủ user-visible states theo `apiErrorSchema`.
- [ ] `bun run verify` xanh; web không chạm `packages/db` (boundary).

---

# E. Tóm tắt quyết định và trạng thái hiện tại

| ID | Câu hỏi | Kết quả / trạng thái |
|---|---|---|
| **D1** | TS đồng bộ | Hoàn tất qua PR #59; `^7.0.2` đã thống nhất; #33 đóng |
| **D2** | Nguồn `summary` | Option A được chốt ở #41 và triển khai ở #58; không migration |
| **D3** | Logging | Hoàn tất qua #55; text một dòng, không phải JSON như đề xuất ban đầu |
| **D4** | CORS | Hoàn tất qua #55; exact-match từ `CORS_ORIGINS`, không thêm package `cors` |
| **D5** | `category` mismatch DB | Còn mở: DB default `general` ngoài enum; mapper hiện fail loud; chưa có migration chuẩn hóa |
| **D6** | `author` hiển thị | PR #58 join `users.name`; author thiếu/rỗng thành `anonymous` |
| **D7** | Cache list/detail live | Còn mở trong #56; issue đề xuất `revalidate = 60` và không thêm React Query |
| — | Issue #31 body `:id` | Đã dùng `:slug` trong API của PR #58 |
| — | Issue #33 số liệu cũ | #33 đóng qua PR #59; thống nhất TypeScript đã xong |

## Rủi ro Wave-1 (tổng hợp — giữ baseline)

- Không mở rộng ngoài wave-1: không auth, không keyset pagination, không Redis
  hay broker middleware nào (đọc #44 đã chốt không thêm infra nếu không có
  nhu cầu multi-instance thật). Scope theo từng issue; boundary checker +
  review giữ line scope.
- Migrations immutable — forward-only, SQL được commit.
- Wave-2 mở khi Wave-1 xanh: #17 (Better Auth) là critical path của community
  M1 (`COMMUNITY_ARCHITECTURE.md` §Milestones) — sẽ có study riêng khi tới.
