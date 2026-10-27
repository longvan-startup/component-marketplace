# RFC-01 — Shared Contracts cho Community Forum & Live Chat

> **Trạng thái: PENDING REVIEW** — đây là tài liệu thiết kế (docs-only), không
> chứa file `.ts` thực thi. Việc review + approve thuộc về **Long
> (`@NguyenTuMinhLong`)** và **Văn (`@DaoDungVan`)** trước khi bất kỳ dòng code
> nào được triển khai. Sau khi approved, contracts code nằm trong
> `packages/shared/src/contracts/` (PR riêng, review theo quy trình thường).
>
> Nguồn đối chiếu: `docs/COMMUNITY_ARCHITECTURE.md` (DESIGN; các quyết định
> D1–D9 ở §13), issue #28 (epic) + #17 (Better Auth) + #30/#39 (pattern
> contract đã dùng) + #31 (#58, pattern endpoint đã sống),
> `packages/shared/src/contracts/{catalog,common}.ts` (PR #39 — pattern đang
> chạy), `packages/db/src/schema.ts` (hiện chỉ `users` + `components`).
>
> Quy tắc trung thực cứng của RFC này: **không suy diễn tài liệu đã được
> implement.** Audit hiện trạng ở `COMMUNITY_ARCHITECTURE.md` §0 vẫn đúng:
> DB chỉ có `users` + `components`; API chỉ có `/health`, `/health/db`,
> catalog read (#58); Better Auth (#17) chưa có một dòng code nào. Mọi thứ
> chưa chốt được gắn nhãn **PROPOSED**.

---

## 1. Mục tiêu & Scope

**Mục tiêu:** chốt sớm 3 modules contracts trước khi code, để Forum/Chat không
lệch nhau giữa hai phía: Long xây REST/WS + migrations, Văn xây UI + mock
fixtures dùng **cùng một hình dạng API (single source of truth)** — không tự
khai báo lại type ở phía người kia (anti-drift, đúng tinh thần #30).

| Module | Nội dung | Milestone |
|---|---|---|
| `contracts/community.ts` | Forum: categories, threads, replies (+ M2: reactions, follows, reports) | M1 core, M2 extension |
| `contracts/chat.ts` | Chat REST: channels, messages, read state | M3 |
| `contracts/realtime.ts` | WS event/command envelopes cho chat | M3 |

**Out of scope của RFC này (cấm):**
- Bất kỳ file `.ts` nào của contracts (sau approved mới implement).
- Migrations/db schema, routes/WS transport, UI — RFC chỉ đề xuất đồng bộ
  (hình dạng) hợp đồng — schema (database) Thams da có (arch doc §6).
- Frontend/Backend implementation (M1–M3 code).
- Thay bất kỳ contract hiện hành nào (catalog/common) — breaking-change-free.

**Điều kiện tiền lệ (blocking dependencies):** phần ~3 phụ thuộc · Forum
thread write endpoints KHÔNG chạy được trước khi #17 (Better Auth) ship.
Read/GET endpoints public không cần auth.

---

## 2. Hiện trạng — EXISTING vs PLANNED vs PROPOSED

| Thành phần | Trạng thái | Bằng chứng |
|---|---|---|
| `users` (Better-Auth-ready: `email_verified`, `image`, `role` enum user/seller/admin) | EXISTING | `schema.ts` migration 0000 |
| `components` | EXISTING | như trên |
| `PAGINATION_LIMITS`, `pageNumberSchema`, `pageSizeNumberSchema`, `apiErrorSchema` | EXISTING | `contracts/common.ts` (#39) |
| `componentSchema` + list/detail envelopes, kebab slug | EXISTING | `contracts/catalog.ts` (#39) |
| Error middleware + CORS + logging (#29→#58) | EXISTING | `apps/api/src/index.ts` |
| Catalog endpoints (GET /components list+detail) | EXISTING | #58 |
| Better Auth (#17) | PLANNED | issue mở, 0 dòng code |
| Forum/Chat bảng + routes + WS + UI | PROPOSED | arch doc §5–7, RFC này |
| `forum_*`/`chat_*` tables | PROPOSED | arch doc §6 (đề xuất, CHƯA migration) |
| `publicAuthorSchema`, các GAP/idempotency mới | PROPOSED | RFC này (RFC-01/05/07/08) |

**Chú ý bảo mật sản phẩm:** `isPublished` của catalog + `thread ẩn` là domain
khác — Forum/Chat PUBLISHED rồi tức là tất cả user thấy (không có draft mode
MVP) — giữ đúng nguyên state của arch doc.

---

## 3. Naming conventions (đồng bộ với catalog #39)

| Quy tắc | Chi tiết | Ví dụ |
|---|---|---|
| JSON field | camelCase | `threadType`, `lastReadSeq` |
| Slug / URL identifier | kebab-case | `help`, `frontend-help` |
| Error code | UPPER_SNAKE | `VALIDATION_ERROR`, `RATE_LIMITED` |
| Tên schema | `<noun>Schema`; response envelope dạng `xxxResponseSchema`; request GET queries dạng `xxxQuerySchema` | `threadSchema`, `threadListResponseSchema`, `threadListQuerySchema` |
| Zod version | zod ^4 (đã pin duy nhất bun.lock) | `z.uuid()`, `z.int()` |
| TS types | luôn derived `z.infer`, KHÔNG redeclare dạng tay | `type CatalogThread = z.infer<typeof threadSchema>` |
| Framework-free | không import express/next/drizzle vào `packages/shared` (boundary CI) | — |
| Reuse primitives | `PAGINATION_LIMITS` + `pageNumberSchema` + `pageSizeNumberSchema` + `apiErrorSchema` từ `common.ts` | không duplicate `common.ts` |
| Event/Command | `x.y` kebab event names; `discriminatedUnion('type')` bắt buộc | `message.created` |
| Enum values | kebab-case string | `'react-component'`, `'in_progress'` (idea status giữ snake_case vì backward mô phỏng database enum) |

---

## 4. DTO field-by-field — `community.ts` (PROPOSED, trừ khi ghi rõ)

### 4.1 `publicAuthorSchema` — profile công khai (RFC-01)

Nhất quán mọi nơi (thread author, reply author, chat message author):

| Field | Kiểu | Nguồn DB | Ghi chú |
|---|---|---|---|
| `id` | uuid | `users.id` | dùng để link profile sau này |
| `name` | string 1..80 | `users.name` | hiển thị trực tiếp |
| `handle` | string kebab-handle 2..80 | PROPOSED — chưa có cột; GTT: sinh từ `name` (như catalog `author` đang dùng `users.name`) | nếu chưa có cột riêng: dùng `name`; có handle riêng coi là M4 |
| `image` | `.string().url().nullable()` hoặc absent | `users.image` | optional trong frame JSON |

**KHÔNG có**: `email`, `emailVerified`, `role`, session/token, mọi field nội bộ.
`role` là dữ liệu authorization — mỗi lần cần phải phân quyền, server-side
check, KHÔNG đưa vào DTO public (tránh client tự render theo role để rồi
become a bypass vector). Xem RFC-02 về quy định moderator role.

Snippets (illustration, không implement):
```ts
export const publicAuthorSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  image: z.union([z.url(), z.null()]).optional(),
})
```

### 4.2 `forumCategorySchema`

| Field | Kiểu | Nguồn | Ghi chú |
|---|---|---|---|
| `id` | uuid | `forum_categories.id` (PROPOSED bảng) | — |
| `slug` | kebab-case | — | 5 khởi đầu bên dưới |
| `name` | string 1..80 | — | — |
| `description` | string optional | — | render trong badge/feed |
| `defaultThreadType` | `forumThreadTypeSchema` | — | PROPOSED — arch doc §4 định default khi UI pre-select |

5 category khởi đầu (PROPOSED seed, arch doc §4/D8):
`help(question)` · `showcase(showcase)` · `ideas(idea)` ·
`feedback(feedback)` · `announcements(announcement, mod-only)`.

### 4.3 Enums

```ts
export const forumThreadTypeSchema =
  z.enum(['question', 'showcase', 'idea', 'feedback', 'announcement'])
export const forumIdeaStatusSchema =
  z.enum(['planned', 'in_progress', 'released', 'rejected'])
// nullable khi mới submit (idea_status NULL = submitted)
export const forumSortSchema = z.enum(['active', 'newest', 'top'])
```

### 4.4 `threadSchema` (detail) vs `threadSummarySchema` (feed)

| Field | detail | summary | Nguồn DB / ghi chú |
|---|---|---|---|
| `id` | ✅ | ✅ | uuid |
| `slug` | ✅ | ✅ | unique kebab (app-sinh) |
| `title` | ✅ | ✅ | 8..160 chars (anti-spam ≥ 8) |
| `body` | ✅ | ❌ | markdown ≤ 20k chars — feed KHÔNG vận chuyển (băng thông) |
| `excerpt` | ❌ | ✅ (PROPOSED) | server derive 200 chars đầu — tránh hidden copying body nhiều lần |
| `categorySlug` | ✅ | ✅ | đọc từ join → không leak category_id nội bộ |
| `threadType` | ✅ | ✅ | enum |
| `author` | `publicAuthorSchema` | ✅ | author deleted → `null`? Chuẩn archive: SET NULL DB ⇒ có thể `author: null` (RFC-09 tombstone consistency) |
| `componentSlug` | ✅ | ✅ | nullable — Discussions tab link |
| `tags` | ✅ | ✅ | array string ≤ 12, mỗi tag 1..40 |
| `ideaStatus` | optional (null = submitted) | ✅ optional | chỉ ý nghĩa khi threadType=idea — validate ở request, response vẫn pass-through được null |
| `releasedComponentSlug` | optional | ❌ | chỉ ý nghĩa idea released; slug tránh leak uuid nội bộ |
| `acceptedReplyId` | optional | ❌ | chỉ question; uuid trả về client để highlight |
| `isLocked` / `isPinned` | ✅ | ✅ | moderation flags — feed cần icon lock + ordering pinned |
| `replyCount` | ✅ | ✅ | cache counters (denormalized) |
| `upvoteCount` | ✅ | ✅ | cache counters |
| `lastActivityAt` | ✅ | ✅ | timestamptz ISO; sort `active` input |
| `createdAt` | ✅ | ✅ | — |
| `updatedAt` | ✅ | ✅ | — |

KHÔNG đưa vào DTO công khai (nội bộ DB): `category_id`, `component_id`,
`released_component_id` (uuid), `author_id`, `deleted_at`, `deleted_by`,
`reply_cache`/`upvote_cache` (counters nội bộ). **Parser strip unknown keys**
→ thêm defense-in-depth tại mapper phía api (pattern đã test ở #58).

**Server-managed vs client-writable**: tạo thread (4.6) — client gửi
`title/body/categorySlug/threadType/componentSlug/tags` thôi. `isLocked`,
`isPinned`, `ideaStatus`, `releasedComponentSlug`, `acceptedReplyId`,
tá mọi counter/timestamps → **server-only**, client PATCH không thể tự set
như role-upgrade vector (xác định trong RFC-05/#7).

### 4.5 `replySchema`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | — |
| `threadId` | uuid | thuộc thread nào |
| `parentReplyId` | uuid nullable | null = reply root |
| `author` | `publicAuthorSchema` | có thể null khi author bị xóa (SET NULL) |
| `body` | string ≤ 10k | — |
| `depth` | int 0..4 | cap 4 — enforce server; client chỉ render |
| `createdAt` / `updatedAt` | ISO string | — |
| `isDeleted` | boolean | tombstone — body vẫn có thể non-empty? KHÔNG: tombstone body = `''` |

**Tombstone tree consistency (RFC-09-like cho forum):** reply bị xóa vẫn
giữ row (depth/parent intact) với `body=''`, `isDeleted=true` — node giữ
chỗ bảo đảm cây con không đứt; client nếu thấy `isDeleted:true` render
"[removed]" không render parent-thread vẫn kết nối.

**Accepted answer integrity (RFC-04):**: `acceptedReplyId` chỉ được set khi
thread `threadType === 'question'` và reply đó thuộc cùng `thread_id` và
chưa tombstone — enforce ở service (SELECT replay check trong transaction),
không PG CHECK cross-row. Author của thread OR moderator được set/đổi/hủy;
không cho reply author tự set chính mình.

### 4.6 Requests — community.ts

| Schema | Fields | Validations | Notes |
|---|---|---|---|
| `threadListQuerySchema` | `category?` kebab-slug · `threadType?` enum · `componentSlug?` kebab · `author?` **uuid** (page người viết, RFC-01 note) · `sort` = `active\|newest\|top`, default `active` · `q?` trim ≤ 80 (ILIKE title/body) · `page`/`pageSize` từ `common.ts` | GET string coercion; không enum sai | — |
| `threadIdParamSchema` | uuid | tham số URL | arch doc dùng uuid cho URI `/community/threads/[threadId]` (D4 arch-doc) |
| `replyListQuerySchema` | `sort: oldest\|newest` default `oldest` · `page`/`pageSize` | phân trang replies độc lập | dùng khi detail nhúng page-1 |
| `createThreadSchema` | `title` 8..160 · `body` 20..20000 · `categorySlug` kebab · `threadType` enum · `componentSlug?` kebab · `tags?` ≤ 12 tag | **cross-check server:** threadType PHẢI khớp category (`help→question`, `showcase→showcase`, `ideas→idea`, `feedback→feedback`, `announcements→announcement`) — sai → `400 VALIDATION_ERROR` (client không tự tin sóng bằng dto) | anti-spam: tối đa 2 links/post · chỉ email_verified-user write |
| `updateThreadSchema` | union phân theo quyền (server decided): author → `title?/body?/tags?` · author Q&A → `acceptedReplyId?: uuid \| null` · author idea → `ideaStatus?` transition theo lifecycle (`planned ↔ in_progress → released\|rejected`) · moderator → `isLocked?/isPinned?/ideaStatus?/releasedComponentSlug?` | **KHÔNG cho client field-modify self-authorize**: server ignore toàn bộ trường không thuộc permission của requester (PROPOSED: trả 403 rõ ràng thay vì silent-drop — reviewer chọn) | lifecycle luôn validate theo transition hợp lệ, không cho client skip state | 
| `createReplySchema` | `body` 1..10000 · `parentReplyId?` uuid · `clientMessageId` string 16..64 | parent reply phải cùng thread + depth cha ≤ 3 (nghĩa depth con ≤ 4) — server check; **GAP clientMessageId** (RFC-05) | — |
| `threadIdParamSchema` trên tạo reply | — | parent phải chưa tombstone | — |

**Quy chế phân quyền field-cá-nhân (tổng hợp):** mọi request parse xong,
controller phân quyền role tương ứng rồi mới chấp nhận dữ liệu — đượcifact
xác nhận từ permission matrix ở arch doc §8.1.

### 4.7 Responses — community.ts

```ts
export const threadListResponseSchema = z.object({
  items: z.array(threadSummarySchema),
  page: pageNumberSchema,
  pageSize: pageSizeNumberSchema,
  total: z.int().min(0),
})
export const threadResponseSchema = z.object({
  thread: threadSchema,
  replies: z.array(replySchema).max(50), // PROPOSED bound — xem dưới
})
export const replyListResponseSchema = z.object({
  items: z.array(replySchema),
  page: pageNumberSchema,
  pageSize: pageSizeNumberSchema,
  total: z.int().min(0),
})
export const createThreadResponseSchema = z.object({ thread: threadSchema })
export const createReplyResponseSchema = z.object({ reply: replySchema })
```

**GAP được chỉ rõ — embedded replies trong `threadResponseSchema`:** arch
doc §7.1 ghi `{ thread, replies }` nhưng chưa bound. PROPOSED (RFC-11):
detail page trả **tối đa 50 replies first-page** (sort `oldest`), client cần
nhiều hơn dùng `GET /community/threads/:id/replies?page=2…` (`replyList-
QuerySchema`). Bảo đảm: **unbounded response không bao giờ xảy ra** (1
thread có thể 10k replies).

### 4.8 Endpoint → schema mapping (community, M1)

| Method + path | Request | Response | Auth |
|---|---|---|---|
| `GET /community/threads` | `threadListQuerySchema` | `threadListResponseSchema` (200) | public |
| `GET /community/threads/:id` | `threadIdParamSchema` | `threadResponseSchema` (200) | public |
| `GET /community/threads/:id/replies` | `threadIdParamSchema` + `replyListQuerySchema` | `replyListResponseSchema` | public |
| `POST /community/threads` | `createThreadSchema` | `createThreadResponseSchema` (201) | auth + rate-limit |
| `PATCH /community/threads/:id` | `updateThreadSchema` | `createThreadResponseSchema` (200) | owner / moderator |
| `DELETE /community/threads/:id` | — | `204` | owner self-soft-delete / moderator |
| `POST /community/threads/:id/replies` | `createReplySchema` | `createReplyResponseSchema` (201) | auth + rate-limit |

M2 extension (CHỈ mô tả, không code trong M1):

| Method + path | Request | Response | Auth | Milestone |
|---|---|---|---|---|
| `POST /community/threads/:id/reactions` | `createReactionSchema` `{targetKind:'thread', targetId, kind:'upvote'}` idempotent | `201 {reaction}` | auth | M2 |
| `DELETE /community/threads/:id/reactions` | same | `204` | auth | M2 |
| `GET /community/threads/:id/replies/:replyId/reactions` | — | `{count, viewerReacted}` | public | M2 |
| `GET /community/threads/:id/follows` | `threadFollowSchema` shape | — | auth | M2 |
| `POST /community/reports` | `createReportSchema` `{targetKind, targetId, reason, details?}` | `201 {report}` | auth | M2 |
| `GET /community/reports` | `{status?}` | `reportListResponseSchema` | moderator/admin | M2 |

`reactionSchema` (proposal): `{id, kind:'upvote', targetKind:'thread'\|'reply', createdAt}` — không gắn user id vào payload tránh mọi viewer đề xuất
điểm chặn duplicate (partial unique index chặn duplicate ở DB).
`threadFollowSchema`: `{threadId, createdAt}` (viewer = requester).
`reportSchema`: `{id, targetKind, reason, status, createdAt, resolvedAt?}` —
danh sách report chỉ lộ cho moderator; KHÔNG rò nội dung report ra public
feed. Report reasons: `spam\|offensive\|off_topic\|copyright\|other`; statuses:
`open\|resolved\|dismissed`.

### 4.9 Runtime validation rules (community)

1. Mọi JSON body đi qua `zod`-schema → lỗi từ zod map vào details
   `400 VALIDATION_ERROR` chú thích `apiErrorSchema` (#39) — KHÔNG tạo
   envelope 2.
2. Cross-check threadType ↔ categorySlug ở server (5 mapping hard-coded).
3. `componentSlug` phải tồn tại thật (SELECT lookup) khi có — không tồn tại
   → 400 (không tạo thread dính vào component ma).
4. `parentReplyId` parse rồi check cùng thread + depth trong transaction
   INSERT (SELECT parent, rồi depth check từ line DB).
5. Rate limit per-user-token-bucket (routing middleware) — 429
   `RATE_LIMITED`.
6. Auth=None → 401 `UNAUTHENTICATED`; thiếu quyền → 403 `FORBIDDEN`; không
   có → 404 `NOT_FOUND` (tombstone threads cũng 404 cho guest, sadece author
   + moderator thấy).

---

## 5. DTO field-by-field — `chat.ts`

### 5.1 `chatChannelSchema`

| Field | Kiểu | Nguồn | Ghi chú |
|---|---|---|---|
| `id` | uuid | `chat_channels.id` (PROPOSED) | — |
| `slug` | kebab | — | `general`, `frontend-help`, `showcase`, `feedback` (seed 4 theo D8) |
| `displayName` | string 1..80 | — | hiển thị rail |
| `description` | ? | optional | — |
| `sortOrder` | int | — | render ordering |
| `isActive` | boolean | — | inactive → ẩn khỏi rail |
| `createdAt` / `updatedAt` | ISO | — | — |
| `unreadCount` | **optional, int ≥ 0** | **derived** từ `chat_read_states` khi session tồn tại | **viewer-specific** — KHÔNG phải dữ liệu channel chung. Đặt optional + nullable-ish với anonymous → absent |

**Quan trọng:** `unreadCount` chỉ tính khi request kèm session; anonymous
response không có trường (`.optional()` — runtime strip ở server, không emit
`undefined` như JSON — omit key).

```ts
export const chatChannelListSchema = z.object({ items: z.array(chatChannelSchema) })
```
(Chốt envelope `{ items }` — catalog dùng `{items, page, pageSize, total}`,
đúng-offsetof channel không paginate vì 4 channel; nếu sau 20 channel mới
cần paginate — additive, không breaking.)

### 5.2 `chatMessageSchema`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | PK (dedupe key 1) |
| `channelId` | uuid | — |
| `seq` | **decimal string** (`/^\d+$/`), e.g. `"123456"` | **không dùng number**: PG BIGINT vượt `Number.MAX_SAFE_INTEGER` (đạt khả năng ở scale lớn hơn mức MVP, nhưng quy chuẩn ngành — serialize int64 là decimal-string EVERYWHERE bao gồm WS envelopes) |
| `author` | `publicAuthorSchema \| null` | null khi author bị xóa (SET NULL) |
| `body` | string ≤ 2000 | — |
| `createdAt` | ISO | created time — sort trong message **PHỤ theo seq, KHÔNG theo time** (D7) |
| `deletedAt` | ISO nullable | tombstone |
| `isDeleted` | boolean | tombstone |

**Tombstone anti-leak (RFC-09):** khi `isDeleted=true` server luôn serialize
`body=''` (empty) — KHÔNG bao giờ kèm raw message gốc trong bất kỳ replay/
REST/WS nào. DB giữ data cho tombstone audit (một mod tool sau M4), nhưng
beyond có thể mọi serialized payload kể cả admin API phải chưa chứa
(nếu phải đọc nội dung xóa — mod tool ở DB level, không qua API public).

### 5.3 Chat REST contracts

| Method + path | Request schema | Response schema | Auth | Notes |
|---|---|---|---|---|
| `GET /chat/channels` | — | `chatChannelListSchema` (200) | public read (D2) | kèm `unreadCount` khi session |
| `GET /chat/channels/:id/messages` | `chatMessageListQuerySchema` | `chatMessageListResponseSchema` (200) | public read (D2) | ASC theo `seq` |
| `POST /chat/channels/:id/messages` | `createChatMessageSchema` | `201 chatMessageSchema`; **200 same retry** | auth + rate-limit | idempotency RFC-05 |

```ts
export const chatMessageListQuerySchema = z.object({
  beforeSeq: seqStringSchema.optional(), // exclusive upper bound (older-than)
  afterSeq:  seqStringSchema.optional(), // exclusive lower bound (newer-than)
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).check((q) => !(q.beforeSeq && q.afterSeq)) // hoặc refine — chỉ chọn 1 hướng mỗi query
export const chatMessageListResponseSchema = z.object({
  messages: z.array(chatMessageSchema), // ASC theo seq
  hasMore: z.boolean(),
})
export const createChatMessageSchema = z.object({
  body: z.string().min(1).max(2000),
  clientMessageId: z.string().min(16).max(64),
})
export const chatReadStateSchema = z.object({
  channelId: z.uuid(),
  lastReadSeq: seqStringSchema,
  updatedAt: z.string(),
})
```

**`beforeSeq`/`afterSeq` semantics (PROPOSED, RFC-11):** KHÔNG cho phép cả
hai cùng lúc nếu không có definition rõ ràng (MVP: cấm — **400
VALIDATION_ERROR**). Omit cả hai = trả 50 message MỚI NHẤT (tail) ASC + 
`hasMore = older tồn tại`. `beforeSeq=` dừng từ từ lịch sử (history paginate);
`afterSeq=` tìm live-catch-up sau resume.

**Read state (`chatReadStateSchema`) — not-regress rule:** mọi update
`lastReadSeq` upsert bằng `GREATEST(existing, incoming)` ở DB (arch doc §6.3)
→ client không thể kéo watermark lùi (reconnect cũ). Server version được
SERVE qua GET channels/messages luôn là giá trị MAX nội bộ đã forwarded.

---

## 6. DTO / Event design — `realtime.ts` (PROPOSED)

Envelopes dùng `discriminatedUnion('type', [...])` — **tất cả** `data` phải
validate bằng schema thật, không `unknown`.

### 6.1 Server → Client events

| type | data schema | nghĩa / auth | error / idempotency |
|---|---|---|---|
| `message.created` | `chatMessageSchema` | broadcast mọi connection subscribe channel; không cần auth (D2 read) | client dedupe theo `message.id` |
| `message.deleted` | `{channelId, id, seq, deletedAt}` | sau REST/WS delete | apply tombstone theo `id` |
| `ack` | `{refClientMessageId, message: chatMessageSchema}` | confirm `send` đã persist | correlate theo `refClientMessageId` |
| `error` | `apiErrorSchema` | mọi lỗi rénewable tái dùng envelope REST (mã `JOB VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR`) | client hiển thị đúng error state |
| **`channel.subscribed`** (PROPOSED) | `{channelId}` | confirm subscribe xảy ra thành công — client không được giả định success trước ack | idempotent subscribe (re-subscribe không error) |
| **`channel.unsubscribed`** (PROPOSED) | `{channelId}` | confirm | idempotent |
| **`resume.completed`** (PROPOSED) | `{channelId?, afterSeq, replayedCount}` | signal hết replay gate → sau đó live stream; giúp client đặt trạng thái "reconnected ✓" | replay không dup gate theo `seq` |

### 6.2 Client → Server commands

| type | data schema | auth / condition | error behavior | idempotency |
|---|---|---|---|---|
| `send` | `{channelId, body, clientMessageId}` | **authenticated** (+ rate limit + email_verified nếu áp D-heuristics) | guest/no-auth → `error` `UNAUTHENTICATED`; rate → `RATE_LIMITED` | server-side persistence reuse `clientMessageId` (RFC-05) |
| `resume` | `{afterSeq: seqString}` | bất kỳ subscription channel nào; **detailDecision** nếu có nhiều channels: `resume.afterSeq` áp dụng per-channel — cần multi-channel. **PROPOSED**: `resume` array-nested dạng `{channels: Array<{channelId, afterSeq}>}` | invalid seq → `error` VALIDATION_ERROR | replay theo seq; server replay hướng one-way`
| `read.advance` | `{channelId, lastReadSeq}` | authenticated (chỉ own watermark) | lastReadSeq không được lùi — server GREATEST | idempotent |
| **`channel.subscribe`** (PROPOSED) | `{channelId}` | guest OK khi D2 read-only (chỉ nhận events, không gửi) | invalid/inactive channel → `error` NOT_FOUND | idempotent: subscribe/duplicate subscription trên cùng connection không tạo lỗi |
| **`channel.unsubscribe`** (PROPOSED) | `{channelId}` | — | no-op nếu chưa subscribe | idempotent |

### 6.3 Ordering & reconnect cursor — P0 analysis (RFC-08)

**Phân tích gap đã nhận diện (đỡ giả định BIGSERIAL bảo đảm commit order — nó
KHÔNG):**

```
T1: INSERT seq=100 (transaction chưa commit)
T2: INSERT seq=101 (commit ngay — bigserial cấp phát lần lượt không theo commit order)
Client: đọc đến seq=101 → lưu cursor `afterSeq=101`
T1: COMMIT (sau)
Client resume: WHERE seq > 101 → BỎ LỠ message 100 ← bug chết người
```

Đây là race thực tế khi concurrent sends + slow transaction (tỷ lệ tăng theo
load). Reducing bộ (không tự chốt — Long review, status PENDING):

- **Option A (PROPOSED — serialized allocation per-channel):** bỏ
  `bigserial`, thay bằng `chat_channels.next_seq BIGINT DEFAULT 0` — mỗi
  transaction send: `UPDATE chat_channels SET next_seq = next_seq + 1
  RETURNING next_seq` (row lock serializes cả allocation lẫn commit order
  trong 1 channel). Cost: mọi send serialize theo channel (OK cho
  single-instance MVP; bottleneck tại scale). Replay/lookup an toàn tuyệt đối.
- **Option B:** giữ `bigserial` + client cursor ALWAYS dùng "committed high
  watermark" (server phải track committed-max — lại thêm bảng trạng thái).
- **Option C:** giữ bigserial + replay overlap: client luôn resume với
  `afterSeq = confirmed - N` (overlap ~5) và dedupe theo `message.id` —
  an toàn theo N, không có edge-bug miss nhưng re-deliver N message cũ
  mỗi reconnect (chi phí chấp nhận được cho MVP).

**Đô مع soát các tình huống (Option A):**
1. **Concurrent sends** — row lock sẽ serialize; throughput bounded bởi
   latency Postgres (vâng cho MVP quy mô 1 channel sống).
2. **Crash/reconnect** — transaction rollback = seq không consume (counter
   rollback cùng transaction ⇒ gần zero-gap; gap đều cũng vô hại vì replay
   theo `>` trên seq đã commit).
3. **Replay + live handoff** — server replay đã persist theo
   `WHERE channel_id = ? AND seq > ? ORDER BY seq ASC`, xong chuyển live
   stream; `seq` là gate đảm bảo replay + live không dup và không miss.
4. **Deduplication** — client dedupe theo `message.id` (server-side cũng
   dedupe bằng idempotency key ở tầng POST).
5. **Cursor retention + deleted messages** — tombstone giữ row + `seq` trơn
   ở replay (arch doc §6.3); unread watermark logic không depend message
   có body.

**WS upgrade + lifecycle (cần verify thật):** `apps/api` là Express chạy trên
Bun HTTP server — `upgrade` handler phải attach từ server gốc (không qua
`app.use`), verify Bun's `server.upgrade()` semantics ở CI (bun test integration);
deploy Vercel Services không giữ WS server → **WS chỉ dành cho VPS deploy**
(P0 guard cho deployment decision — có thể select không deploy WS trên
Vercel mà vẫn có lòng fallback REST long-poll? KHÔNG — out-of-scope; replanted
lại đề xuất: local/docker/vps chạy WS, Vercel build không mount WS route
và Web phải degrade xuống polling khi WS not available). Khối work này
(transport check) là **Implementation-phase test**, không contract unit.

---

## 7. Idempotency & dedup matrix (RFC-05)

| Trường hợp | Behavior (PROPOSED) |
|---|---|
| POST chat message, key mới | 201 + message mới + broadcast `message.created` |
| Retry cùng (channel_id, author_id, client_message_id) | **200** + cùng payload (SELECT row hiện có) — không broadcast lại |
| Cùng key + **body khác nhau** | **200** + payload đã LƯU (server wins) — client nhận mismatch tự log; KHÔNG update row (idempotency semantically pure); KHÔNG 409 vì sẽ force retry loop |
| Cùng key từ **2 users khác nhau** | không collide — unique key scope gồm `author_id` ⇒ mỗi user một idempotency space (PROPOSED scope 3-cột; arch doc hiện ghi `UNIQUE(channel_id, client_message_id)` — cần Long confirm đổi) |
| Client mất ACK rồi WS resume | retry cùng key → 200 row cũ — zero-duplicate |
| Forum reply tạo (cùng pattern) | apply same key — **GAP**: arch doc §6 không ghi cột `client_message_id` trên `forum_replies` — PHẢI thêm: cột + unique key để cơ chế hoạt động (RFC-05, M1) |

**Notes:** key TRẢ VỀ client-generated (thêm `client_message_id` cột +
partial-unique index là đủ d): các cột scope đi kèm unique index định nghĩa
migration — KHÔNG tự thay DB trong phase này.

---

## 8. Bảng quyết định bắt buộc phải ra (Decision log) — RFC-01..RFC-12

Quy ước: DECISION của `COMMUNITY_ARCHITECTURE.md` D1–D9 được **tham chiếu
nguyên văn (không định nghĩa lại)** — RFC dùng mã riêng `RFC-nn` để không
đè số cũ. Mọi dòng khởi đầu **PENDING** trừ khi có quyết định trải nghiệm
thật từ owner (đánh vào cột Status khi moderate review).

| Decision ID | Current Design (arch doc / #39) | Proposed (RFC này) | Alternatives | Consequences | Owner | Status |
|---|---|---|---|---|---|---|
| RFC-01 (`publicAuthorSchema`) | Catalog dùng `author: string` (name), không profile công dụng chung | Thêm `publicAuthorSchema {id, name, image?}` dùng DUY NHẤT ở Forum/Chat; không email/session/role; author bị xóa ⇒ `null` | (a) chỉ dùng `name` string như catalog (nhét pérdida id/profile URL) · (b) full user DTO | Forums/chat cần link-profile; (b) leak role/email risk | L+V | PENDING |
| RFC-02 ↔ arch D1 (moderator role) | `user_role` = `user/seller/admin` | Approve thêm `'moderator'` (forward-only migration, M2); `seller` không tự mod | giữ admin-only đến M2 | mod tools (lock/pin/reports) cần actor rõ ràng | L+V | PENDING (D1) |
| RFC-03 ↔ arch D2 (guest read-only) | Guest đọc chat + forum nếu policy | Confirm D2 đúng như arch doc; guest được `channel.subscribe` nhưng không `send` | (a) login-only chat | đơn giản hơn nhưng mất funnel | cả hai | PENDING (D2) |
| RFC-04 acceptedReplyId integrity | Enforce ở middleware/validation (arch §6.1) | Service-level check trong transaction: cùng thread + đã chưa tombstone + thread.question; set/change/cancel chỉ thread author hoặc moderator | PG CHECK cross-row (không dùng — arch đã chốt) | integrity bug → accepted answernych kịch | Long | PENDING |
| RFC-05 reply/message idempotency | chat_messages có `UNIQUE(channel_id, client_message_id)`; **forum_replies NO key** (GAP) | Thêm `client_message_id` cột + unique `UNIQUE(thread_id, author_id, client_message_id)` trên forum_replies; scope chat chuyển 3-cột `(channel_id, author_id, client_message_id)` (tách không user-collision) | giữ 2-cột scope (collision risk giữa users) | retry-safe; migration nhỏ khi M1 | Long | PENDING |
| RFC-06 ↔ arch D5 (read state) | `chat_read_states` + WS `read.advance` primary, REST fallback; upsert GREATEST | Confirm; chú field `unreadCount` optional viewer-derived trên `chatChannelSchema`; anonymous = field absent | always include `unreadCount: null` | JSON shape cleaner; FE đỡ bridging | Long | PENDING (D5) |
| RFC-07 WS subscribe/unsubscribe protocol | arch: subscription là internal set, không protocol confirmation | Thêm `channel.subscribe`/`channel.unsubscribed`/`resume.completed` vào union (client không fake success) | không thêm (client tự track từ broadcast đầu tiên — khó debug khi empty-channel) | protocol rõ ràng, debug đơn giản | L+V | PENDING |
| RFC-08 ↔ arch D7 (seq ordering + cursor) | `seq BIGSERIAL` như cursor | **PHẢI review lại**: bigserial có commit-order race (§6.3); Option A (next_seq counter column serialized per-channel) — hoặc Option C (overlap + id dedupe) nếu Long từ chối Option A | giữ bigserial + tracking committed-watermark (Option B) | bug miss-message chặn mọi resume logic | Long | PENDING (D7 cần rethink) |
| RFC-09 tombstone serialization | tombstone giữ row + seq (arch §6.3) | API/WS luôn serialize `body=''` + `isDeleted=true`; author `null` nếu user xóa | trả text "[deleted]" hardcode | client render chủ động; audit DB vẫn giữ nguyên | Long | PENDING |
| RFC-10 ↔ arch D3 (markdown) | Sanitizer: strip HTML; stack = D3 Văn PoC | RFC chỉ chốt **CONTRACT**: field `body` là raw markdown; sanitization chỉ diễn ra ở render; `excerpt` là plain-text 200 chars derive server-side | render raw (KHÔNG — XSS) | CSP + sanitizer trách nhiệm Văn; contract không đổi | Văn (stack) | PENDING (D3) |
| RFC-11 API response envelopes | catalog `{items,page,pageSize,total}` + `{item}` | forum same + mới: `{thread, replies}` (replies bound ≤ 50); chat: `{items}` + `{messages, hasMore}`; lỗi: duy nhất `apiErrorSchema` | per-domain envelope mới (loại) | hiện consistency; bọc chi tiết `@coderabbitai` khi review | L+V | PENDING |
| RFC-12 M1/M2/M3 scope boundary | arch §12 milestones | Confirm khớp: M1 = community.ts core; M2 = reactions/follows/reports extension; M3 = chat.ts + realtime.ts | clumping tất cả trong 1 PR (từ chối — review khó) | timeline + ownership run parallel đúng | L+V | PENDING |

### Mapping đầy đủ endpoint ↔ schema (overview, đã chi tiết ở §4.8/§5.3)

| Domain | Endpoint | Request | Response |
|---|---|---|---|
| Forum | `GET /community/threads` | `threadListQuerySchema` | `threadListResponseSchema` |
| Forum | `GET /community/threads/:id` | `threadIdParamSchema` | `threadResponseSchema` (bounded) |
| Forum | `GET /community/threads/:id/replies` | `replyListQuerySchema` | `replyListResponseSchema` |
| Forum | `POST /community/threads` | `createThreadSchema` | `createThreadResponseSchema` |
| Forum | `PATCH /community/threads/:id` | `updateThreadSchema` | `createThreadResponseSchema` |
| Forum | `DELETE /community/threads/:id` | — | `204` |
| Forum | `POST /community/threads/:id/replies` | `createReplySchema` | `createReplyResponseSchema` |
| Forum M2 | reactions + reports | `createReactionSchema` etc | các schema M2 |
| Chat | `GET /chat/channels` | — | `chatChannelListSchema` |
| Chat | `GET /chat/channels/:id/messages` | `chatMessageListQuerySchema` | `chatMessageListResponseSchema` |
| Chat | `POST /chat/channels/:id/messages` | `createChatMessageSchema` | `201 chatMessageSchema` / `200 retry` |
| Realtime | WS `/ws/chat` | `chatCommandSchema` (union) | `chatEventSchema` (union) |

### Dependencies Forum ↔ Auth ↔ Chat

```
users (EXISTING) ── Better Auth #17 (PLANNED, M1-GATE tạo nội dung)
   │                        │
   ├── forum_threads ── createdAt/author từ session; write endpoints chờ auth
   ├── forum_replies (cascade tree)
   ├── chat_messages  (author nullable vì tombstone khi author xóa)
   └── WS upgrade     (session cookie check; guest D2 read-only)
```

- Auth #17 KHÔNG ship ⇒ M1 write (POST/PATCH/DELETE + reply) chưa có
  thi hành thật; contracts vẫn chốt được sớm (schema-side không phụ
  thuộc runtime auth).
- Chat phụ thuộc Contracts `publicAuthorSchema` (RFC-01) — same DTO dùng
  Forum + Chat tránh 2 shapes author.
- #29 (bootstrap) đã merge (#55): error middleware + CORS sẵn — chỉ mở rông
  routes; KHÔNG cần thêm infra cho contracts.

---

## 9. Test plan (để REVIEW trước khi triển khai contracts)

### 9.1 Unit / contract tests (packages/shared, colocated `<module>.test.ts`)

| Contract | Test cases |
|---|---|
| `community.ts` | valid thread full-parse; úrs min/max boundaries (title 8, body 20k, tags 12, excerpt 200); invalid: threadType sai cặp category (cross-check schema field server-side test với fixture map), slug sai kebab, internal-field leak (parse một row GÁN THỊ có `author_id` → bị strip); patch updateThreadSchema phân observed quyền (author fields vs mod fields theo union); acceptedReplyId constraint tại service (fixture transaction ở tích hợp tests) |
| `chat.ts` | message valid; 2000-char boundary; BIGINT seq decimal-string parse (`"123456"`, reject `123456` number + overflow `"9223372036854775808"` thật); beforeSeq X-OR afterSeq (cả hai = invalid); tombstone shape; unreadCount optional; lastReadSeq không lùi (GREATEST — integration) |
| `realtime.ts` | mỗi event/command parse đúng; unknown `type` → reject (union); malformed data → reject; ack correlate refClientMessageId; resume arrays per-channel; subscribe/unsubscribe idempotent |

### 9.2 Integration tests (API + DB — phase implementation, KHÔNG trong contracts PR)

- POST message idempotency flow end-to-end (201 → retry 200 → không dup row; broadcast ack một lần duy nhất).
- Reply depth 4 + parent wrong-thread → 400.
- 10 concurrent upvotes → đúng 1 row (M2).
- 2 browser WebSocket sessions: cùng nhận < 1s; restart/reconnect resume không miss và không dup sau upload lag.
- Tombstone: delete message → list/replay/client-đều nhận body rỗng, KHÔNG raw.
- Unread không bị lùi khi client cũ reconnect réal sau khi server đã watermark.
- Migration smoke: forum_categories (5 seeded) + chat_channels (4 seeded) theo D8.

### 9.3 Phân biệt rõ hơn nữa (anti slop)

- **Zod không tự test được**: transaction boundaries, authorization, WS
  delivery, ordering commit — những covered ở Integration/WS tests.
- Được là unit contract PR: KHÔNG cần Postgres (chạy được mọi môi trường),
  KHÔNG cần mock network.

---

## 10. Definition of Done (cho PR contracts SAU KHI RFC approved)

1. `packages/shared/src/contracts/{community,chat,realtime}.ts` + colocated
   tests — không đổi file hiện hành; `index.ts` re-export nối dài
   (additive-only).
2. `bun run verify` ALL GATES PASS (lint/boundary/typecheck/test/build).
3. Cả 2 owner approved PR (packages/shared quy tắc opposite-owner review).
4. Không dependency mới ngoài zod (đã có).
5. Bộ test đã liệt kê §9.1 đủ + không test-g lá (assertions thật).
6. `docs/COMMUNITY_ARCHITECTURE.md` status update: contracts EXISTING sau
   merge; decision log RFC status cập nhật.
7. Sau merges: issues implementation M1/M2/M3 mở theo đúng boundary RFC-12.

---

## 11. Thứ tự implementation sau khi RFC approved

```
PR-1  contracts: community.ts core (M1) + tests          (Long đề xuất, Văn review)
PR-2  contracts: community.ts extension (M2 — reactions/follows/reports)  (sau khi RFC-02/D1 chốt role)
PR-3  contracts: chat.ts + realtime.ts (M3) + tests      (sau RFC-05/07/08 chốt)
Sau mỗi PR contracts: backend implementations và frontend mock fixtures
chạy SONG SONG theo track ownership (arch doc §12 parallel plan).
```

- **Không** bắt đầu PR-1 trước khi RFC merged (quy tắc review-first).
- Mỗi PR contracts reruns verify + review như bình thường.
