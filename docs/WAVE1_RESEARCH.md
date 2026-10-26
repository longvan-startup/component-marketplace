# Nghiên cứu Wave-1 — trước khi code feature đầu tiên

Nền tảng (infra / CI-CD / contract / onboarding) đã đóng xong ở #44–#52.
Wave-1 (epic #28) là **lần code feature thực sự đầu tiên** — tài liệu này
nghiên cứu sâu từng phần TRƯỚC khi code, theo đúng tiền lệ
`COMMUNITY_ARCHITECTURE.md` (nghiên cứu → owner duyệt → mới code). Mỗi phần:
hiện trạng đọc từ code thật, khoảng cách contract↔DB, quyết định cần duyệt
(D1–D7), rủi ro, tiêu chí hoàn thành. Không có code nào được gõ trước khi các
quyết định trong §E được duyệt.

Trạng thái tài liệu: **proposed — chờ owner duyệt D1–D7**
(cập nhật cuối: 2026-10-26).

## Thứ tự code khuyên dùng (sau khi duyệt)

```text
#33 deps unify (khóa phần — làm TRƯỚC, tránh bun.lock xung đột liên quan)
   → #29 api bootstrap (móng cho mọi endpoint)
      → D2 (tài liệu này quyết #41)
         → #31 endpoints catalog (Long)
            → #32 live wiring web (Văn)   ← bước docs song song được với #31
```

#17 (Better Auth) là wave sau — KHÔNG thuộc Wave-1, study riêng khi tới
(§ Rủi ro cuối tài liệu).

---

# A. #33 — Đồng bộ version các workspaces

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
lỗi thời (chỉ cần comment sửa lại số liệu khi PR #33 mở). Mismatch thật còn
lại duy nhất: **TypeScript 7.0.2 (4 workspace) vs 5.9.3 (db)**.

## Quyết định cần duyệt

**D1 — TS version: đề xuất thống nhất `^7.0.2` toàn workspace** (bump
`packages/db` lên 7, bỏ 5.9.3).

- Cơ sở: 4/5 workspace đã chạy TS7 ổn qua mọi gates từ trước; TS7 chỉ dùng
  để typecheck — `drizzle-kit` sinh migration không phụ thuộc compiler TS;
  chưa thấy điểm nào của TS7 phá code db hiện tại.
- Rủi ro / fallback: nếu typecheck của `packages/db` lộ mismatch với TS7
  (types của drizzle viết cho TS5...) ⇒ giữ db ở 5.9.3 và **ghi lý do rỏ ràng
  trong issue** — không chấp nhận giải pháp nửa vời giữa hai version.

## Tiêu chí hoàn thành

- [ ] Manifests cùng một major TS (hoặc fallback được giải thích rõ ràng).
- [ ] `rm bun.lock && bun install` ⇒ diff lock **chỉ thay đổi dòng version,
      không cài thêm lá nào khác**.
- [ ] Biome vẫn pin chính xác `2.5.15` (regression rule — không bump nhân
      tiện PR này).
- [ ] `bun run verify` ALL GATES PASS; CI xanh; files `packages/db/drizzle/**`
      không bị Biome format lại (rule #16).

---

# B. #29 — API bootstrap layer

## Hiện trạng (`apps/api/src/index.ts` — đọc thật)

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

## Đề xuất nội dung (cân với các quyết định)

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

## Tiêu chí hoàn thành (mapped từ issue #29)

- [ ] Env lỗi ⇒ service không boot, log chỉ ra biến nào sai.
- [ ] Route sai / thiếu env / DB chết ⇒ đúng **một** JSON shape (theo
      `apiErrorSchema`), không stacktrace ở prod.
- [ ] `bun test` có case: CORS header theo trạng thái, error envelope cho
      3 sự cố, shutdown gọi `pool.end()` (spy).
- [ ] `bun run verify` xanh; boundary không đổi (`apps/api` chỉ vẫn
      import `packages/db` + `packages/shared`).

---

# C. #31 — Read endpoints catalog (+ quyết định #41 blocker)

## Khoảng cách Contract ↔ DB (bảng kiểm đọc thật từng field — rủi ro lớn nhất Wave-1)

| Field hợp đồng (`componentSchema`) | DB schema thật (`components`) | Khoảng cách | Đề xuất Wave-1 |
|---|---|---|---|
| `summary` (required, ≤300) | **KHÔNG có cột** | #41 (blocker) | **D2 dưới đây** |
| `description` (required, ≥1) | `text NULL` | nullable vs required | Migrate: `NOT NULL DEFAULT ''` + mapper không fallback ngầm |
| `category` (enum 3 giá trị) | `text DEFAULT 'general'` | `'general'` nằm ngoài hợp đồng enum | Migrate: default → `'react-component'` + check constraint; map các row `general` cũ khi migrate |
| `author` (handle string ≥2) | `authorId` uuid FK | khác kiểu | Join `users` lấy `name` (handle v1 = name); `author_id NULL` ⇒ `'anonymous'` (ghi chú rõ trong mapper) |
| `id / slug / name / tags / latestVersion / isPublished` | khớp | — | — |
| `isPublished = false` | có | public list **chỉ hiện published** | SQL `WHERE is_published = true` cho list **và** detail (404 khi chưa publish) |

## D2 — quyết #41 (đề xuất: **Option B — thêm cột**)

- **B (đề xuất)**: `packages/db` migrate thêm `summary varchar(300)` NOT NULL
  DEFAULT ''. Lý do: (1) hợp đồng đã required, web đã render `summary` từ
  #39; (2) `description` nullable ⇒ derive server dễ vỡ hợp đồng ngay khi
  gặp row thiếu description; (3) editor sau này muốn teaser thủ công — B
  không phải đổi hợp đồng lần nữa; (4) migrations được commit, forward-only,
  chi phí rất thấp với team 2 người.
- **Option A** (derive slice 280 server-side) vẫn hợp lệ nếu muốn đỡ migration,
  đánh đổi: DB không thể không có description ⇒ chỉ có thể dùng khi đã migrate
  `description NOT NULL`, nhưng vẫn không giải quyết tương lai teaser tay.
- Hệ quả: nếu duyệt B ⇒ PR `packages/db` (migrate + seed) **phải đi trước**
  PR #31.

## Endpoints — chốt theo hợp đồng (bỏ mọi câu hỏi khác)

- `GET /components` — query qua `listRequestSchema` (zod parse; sai ⇒ 422
  theo `apiErrorSchema`). **Detail dùng `:slug`**: issue #31 cũ viết
  `GET /components/:id` — hợp đồng #39 (đã merge) chốt **`GET /components/:slug`**
  (id giữ internal) → sửa trong PR body + comment issue khi mở PR.
- SQL: `limit/offset` (wave-1); sort `newest` = `created_at DESC`, `name` =
  `name ASC`; filter nhỏ nhất: `q` = `name ILIKE` + overlap tags,
  `category` exact — chính là "smallest useful set" issue #31 yêu cầu, ghi
  lựa chọn vào README của api. Skip keyset pagination đến lúc pageSize lớn
  cho thấy cần.
- Public surface trên Vercel = `/api/components…` (dual mount đã dựng #46);
  internal binding calls vẫn dùng path gốc.

## Tích hợp test

- Pattern disposable Postgres: tái dùng `scripts/docker-smoke.lib.sh` + compose
  overlay (nền đã có từ #30/#34); điểm mới: **assert response qua
  `listResponseSchema`** (không tự do đoán field) + case 404 (slug miss) +
  422 (pageSize 999) + empty page.

## Tiêu chí hoàn thành

- [ ] D2 được quyết **trước** PR đầu của #31.
- [ ] Migration + seed (nếu B) đi trước, cùng bước với thay đổi hợp đồng
      (không per-workspace trễ).
- [ ] happy / empty / 404 / 422 + envelope assert theo hợp đồng; boundary ✓.

---

# D. #32 — Web data layer **live** (wiring)

## Phần ĐÃ xong (từ #38/#39 — đừng làm lại)

App shell, tokens Tailwind `@theme`, mock/live switch (`API_MODE`),
`api-client` + quy tắc base URL theo runtime, UI primitives, render catalog
RSC, smoke marker `data-smoke`.

## Phần còn lại (scope đúng bây giờ)

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

# E. Tóm tắt quyết định cần owner duyệt

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| **D1** | TS đồng bộ: bump `packages/db` lên 7? | **Yes — tất cả `^7.0.2`** (fallback có thể giải thích rõ nếu typecheck drizzle lỗi) |
| **D2** | #41: `summary` từ đâu? | **B — thêm cột `summary varchar(300)`** (migrate + seed đi trước #31) |
| **D3** | Logging | **console JSON 1 dòng, 0 dep** (không pino) |
| **D4** | CORS | **không cài `cors` pkg** — middleware tự viết, exact-match từ `CORS_ORIGINS` |
| **D5** | `category` mismatch DB | **migrate: default `'react-component'` + check constraint + seed** (không thêm enum mới trong Wave-1) |
| **D6** | `author` handle là gì? | **join users lấy `name`**, NULL ⇒ `'anonymous'` (#17 với auth sẽ chuẩn hoá sau) |
| **D7** | Cache list/detail live? | **`revalidate = 60`** (no-store chờ verified realtime) |
| — | Issue #31 body `:id` | Sửa thành `:slug` trong comment khi mở PR #31 (hợp đồng đã chốt) |
| — | Issue #33 số liệu cũ | Comment sửa số liệu thực khi mở PR #33 (dữ liệu thật ở §A) |

## Rủi ro Wave-1 (tổng hợp — giữ baseline)

- Không mở rộng ngoài wave-1: không auth, không keyset pagination, không Redis
  hay broker middleware nào (đọc #44 đã chốt không thêm infra nếu không có
  nhu cầu multi-instance thật). Scope theo từng issue; boundary checker +
  review giữ line scope.
- Migrations immutable — forward-only, SQL được commit.
- Wave-2 mở khi Wave-1 xanh: #17 (Better Auth) là critical path của community
  M1 (`COMMUNITY_ARCHITECTURE.md` §Milestones) — sẽ có study riêng khi tới.
