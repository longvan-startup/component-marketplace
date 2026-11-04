# Auth research — infra, luồng FE↔BE, vì sao Better Auth

Ghi chú onboarding của Văn (frontend) trước khi tiếp tục làm auth (issue #92),
theo yêu cầu của Long. Không lặp lại nội dung đã có ở `apps/web/README.md` hay
`docs/ENGINEERING.md` — chỉ tóm tắt đường đi + phần còn thiếu (lý do chọn
Better Auth).

## 1. Infra & luồng FE↔BE — bản đồ nhanh

- **API**: Bun + Express 5 (`apps/api/src/index.ts`). Middleware order: CORS
  allowlist → request log → Better Auth (`/api/auth/*`) → `express.json()` →
  router (`health`, `/components`, `/components/:slug`) → 404 → error handler.
- **DB**: Drizzle ORM trên Postgres (`packages/db`), migrations ở
  `packages/db/drizzle/*.sql`. Chỉ `apps/api` được import `@marketplace/db`.
- **Deploy**: `vercel.json` route `/api/(.*)` sang service `api`, còn lại sang
  `web` — web build/deploy qua Git integration của Vercel, không qua
  `cd.yml`. `cd.yml` chỉ lo build+push image API (GHCR), chạy Drizzle migrate
  lên Neon (`PROD_DATABASE_URL`), rồi SSH deploy VPS — tất cả có guard, bỏ qua
  nếu thiếu secret.
- **CI** (`ci.yml`): boundary → lint → typecheck → test → build (shared→api→
  web) trên mỗi PR/push `main`; job riêng chạy Docker compose smoke.
- **FE gọi BE qua**: `apps/web/lib/api-client.ts` — chọn base URL theo thứ tự
  `API_URL_INTERNAL` (server, Vercel tự inject) → `NEXT_PUBLIC_API_URL` →
  same-origin `/api`.
- **Switch mock/live**: `apps/web/features/catalog/catalog-source.ts` là điểm
  truy dữ liệu duy nhất, đọc biến `API_MODE` — **bất kỳ giá trị nào khác
  `'live'` đều là mock**. Mặc định `bun run dev:web` chạy hoàn toàn bằng mock,
  không gọi HTTP gì tới API trừ khi set `API_MODE=live` tay.
- **Lưu ý nhỏ phát hiện khi research** (không nằm trong PR này): comment đầu
  file `catalog-source.ts` vẫn ghi contract `componentSchema` là "còn chờ
  review", nhưng contract đó đã implement thật và đang được
  `apps/api/src/catalog/mapper.ts` dùng trong production — comment đã cũ,
  nên sửa khi có dịp đụng file đó.

## 2. Vì sao Better Auth (so với các lựa chọn khác)

Better Auth đã được chọn và implement từ PR #80 (đóng issue #17) — không còn
là câu hỏi mở về mặt code, nhưng repo chưa từng ghi lại lý do so sánh với các
lựa chọn khác (`docs/WAVE1_RESEARCH.md` có nói sẽ "study riêng khi tới" nhưng
chưa ai viết). Ghi lại đây để người sau không phải hỏi lại.

| Lựa chọn | Vì sao không chọn (trong bối cảnh repo này) |
|---|---|
| **NextAuth.js / Auth.js** | Gắn chặt với Next.js (route handlers, session trong Next). API của dự án là **Express service độc lập** (`apps/api`), không phải Next API routes — dùng Auth.js nghĩa là phải chạy auth logic kẹt trong `apps/web`, phá nguyên tắc "API chỉ nói chuyện qua HTTP contract" đang theo (`apps/web/AGENTS.md`). |
| **Lucia** | Nhẹ và framework-agnostic, nhưng đã deprecated hướng "thư viện" để chuyển sang "hướng dẫn tự viết" — nghĩa là tự quản lý nhiều hơn (session store, password hashing, email verification flow) đúng lúc dự án muốn tránh over-engineer, không muốn tự dựng lại các mảnh đó. |
| **Clerk / Supabase Auth (SaaS)** | Managed service, cần tài khoản ngoài + phụ thuộc vendor cho một tính năng lõi (auth), tốn phí theo MAU. Dự án tự host Postgres (Neon) sẵn cho `packages/db` — dùng SaaS auth sẽ tạo thêm một nguồn identity song song, trong khi `docs/COMMUNITY_ARCHITECTURE.md` đã chốt nguyên tắc "Better Auth là nguồn identity duy nhất, không tạo session system thứ hai". |
| **Tự viết (JWT/session tay)** | Phải tự làm password hashing, session rotation, CSRF, email-verification token, rate-limit — đúng loại việc dễ làm sai bảo mật nhất, và ngược hẳn tinh thần "không over-engineering". |
| **Better Auth (đã chọn)** | TypeScript-first, chạy được trong Express thuần (không ràng buộc Next.js) qua `toNodeHandler`; có adapter Drizzle sẵn (`provider: 'pg'`) khớp thẳng `packages/db`; tự host (không phụ thuộc SaaS); đã có sẵn email+password, session cookie, cơ chế field mở rộng (dùng cho `role`) và **hook để validate trước khi lưu** (chính là cái PR #91 đang dùng) — tức là mở rộng được (issue #92: email verification/reset) mà không cần đổi core. |

**Kết luận**: Better Auth phù hợp vì khớp đúng 2 ràng buộc kỹ thuật có sẵn
(Express độc lập + Drizzle/Postgres tự host) mà không kéo theo chi phí tự
viết lại các mảnh bảo mật cốt lõi — đúng tinh thần "không over-engineering"
Long nhắc tới. Các quyết định mở rộng tiếp theo (issue #92) nên tận dụng cơ
chế hook/plugin có sẵn của Better Auth thay vì viết thêm một lớp auth riêng.
