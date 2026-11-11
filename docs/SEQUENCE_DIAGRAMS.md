# Sequence diagrams — Component Marketplace

15 sơ đồ tuần tự cho các chức năng được đánh dấu **Sequence** trong bảng
"Danh sách functions" (cột Diagram). Mỗi sơ đồ bám theo code đang chạy; chức
năng chưa có code thì bám theo tài liệu thiết kế và ghi rõ **DỰ KIẾN**.

- **Nguồn chính** là các file `docs/assets/seq-*.mmd`. Các khối Mermaid trong
  trang này là bản sao để đọc liền mạch trên GitHub — sửa sơ đồ thì sửa file
  `.mmd` rồi chép lại vào đây, không sửa lệch hai nơi.
- Repo chưa có pipeline render PNG (xem skill `diagram-design`); cần ảnh cho
  báo cáo thì mở file `.mmd` trên GitHub hoặc dán vào <https://mermaid.live>
  rồi xuất ảnh.
- Kiểm tra cú pháp: cả 15 sơ đồ đã được parse + render bằng Mermaid 11.4.1.

## Bảng tổng hợp

| Mã | Chức năng | Trạng thái | File nguồn |
|---|---|---|---|
| AU-01 | Đăng ký + xác minh email | Backend đã chạy · UI web đang làm | [`seq-au-01-register.mmd`](assets/seq-au-01-register.mmd) |
| AU-02 | Đăng nhập | Backend đã chạy · UI web đang làm | [`seq-au-02-login.mmd`](assets/seq-au-02-login.mmd) |
| AU-03 | Đăng xuất | Backend đã chạy · UI web đang làm | [`seq-au-03-logout.mmd`](assets/seq-au-03-logout.mmd) |
| AU-04 | Xem tài khoản | Backend đã chạy · chưa có trang | [`seq-au-04-view-account.mmd`](assets/seq-au-04-view-account.mmd) |
| AU-05 | Quên / đặt lại mật khẩu | Đã chạy đủ | [`seq-au-05-reset-password.mmd`](assets/seq-au-05-reset-password.mmd) |
| CT-07 | Xem chi tiết component | Đã chạy (có 1 lỗi đã biết ở chế độ live) | [`seq-ct-07-component-detail.mmd`](assets/seq-ct-07-component-detail.mmd) |
| SE-01 | Tạo listing (bản nháp) | API đã chạy, chỉ admin · chưa có màn Admin | [`seq-se-01-create-listing.mmd`](assets/seq-se-01-create-listing.mmd) |
| CM-01 | Đăng ký gói Pro | DỰ KIẾN (RFC-02) | [`seq-cm-01-subscribe-pro.mmd`](assets/seq-cm-01-subscribe-pro.mmd) |
| CM-02 | Xem trạng thái gói | DỰ KIẾN (RFC-02) | [`seq-cm-02-membership-status.mmd`](assets/seq-cm-02-membership-status.mmd) |
| CM-03 | Cài component Pro | DỰ KIẾN (RFC-02) | [`seq-cm-03-install-pro-component.mmd`](assets/seq-cm-03-install-pro-component.mmd) |
| FR-06 | Xem thread + trả lời | DỰ KIẾN (RFC-01) | [`seq-fr-06-view-thread.mmd`](assets/seq-fr-06-view-thread.mmd) |
| FR-07 | Tạo thread | DỰ KIẾN (RFC-01) | [`seq-fr-07-create-thread.mmd`](assets/seq-fr-07-create-thread.mmd) |
| FR-09 | Trả lời lồng nhau (tối đa 4 cấp) | DỰ KIẾN (RFC-01) | [`seq-fr-09-nested-reply.mmd`](assets/seq-fr-09-nested-reply.mmd) |
| CH-03 | Gửi / nhận tin nhắn realtime | DỰ KIẾN (RFC-01) | [`seq-ch-03-realtime-message.mmd`](assets/seq-ch-03-realtime-message.mmd) |
| CH-05 | Kết nối lại và tiếp tục | DỰ KIẾN (RFC-01) | [`seq-ch-05-reconnect-resume.mmd`](assets/seq-ch-05-reconnect-resume.mmd) |

Thành phần dùng chung trong các sơ đồ: **Web** = `apps/web` (Next.js), **API**
= `apps/api` (Express), **Better Auth** = thư viện xử lý toàn bộ
`/api/auth/*` bên trong API, **PostgreSQL** qua Drizzle (`packages/db`),
**Email** hiện chỉ là `console.log` ở môi trường dev (chưa chọn nhà cung cấp).

## Nhóm: Xác thực (đã có backend)

### AU-01 — Đăng ký + xác minh email

Nguồn: `apps/api/src/auth/config.ts` (`requireEmailVerification`, `sendOnSignUp`, `autoSignInAfterVerification`), `apps/api/AUTH.md`, `apps/web/app/verify-email/page.tsx`. Đăng ký **không** trả phiên — người dùng chỉ đăng nhập được sau khi xác minh email.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL
    participant M as Email (dev: console.log)

    Note over W,BA: AU-01 · Backend đã chạy. Màn Đăng ký trên web đang làm
    U->>W: Nhập tên, email, mật khẩu
    W->>A: POST /api/auth/sign-up/email (credentials include)
    A->>BA: authHandler chuyển nguyên request
    alt Dữ liệu không hợp lệ (vd mật khẩu ngoài 8–128 ký tự)
        BA-->>W: Lỗi theo định dạng Better Auth
        W-->>U: Hiện lỗi ngay trên form
    else Hợp lệ
        BA->>DB: Một transaction: INSERT users (role=user, email_verified=false) + INSERT accounts
        DB-->>BA: Commit
        BA->>M: sendVerificationEmail(url), link sống 15 phút
        BA-->>W: 200 token=null + user (chưa có cookie phiên)
        W-->>U: Nhắc mở email để xác minh
    end

    U->>A: Mở link GET /api/auth/verify-email (token, callbackURL)
    A->>BA: authHandler
    alt Token sai hoặc hết hạn
        BA-->>U: 302 về callbackURL kèm error=INVALID_TOKEN hoặc TOKEN_EXPIRED
    else Token hợp lệ
        BA->>DB: UPDATE users SET email_verified=true, tạo phiên
        BA-->>U: 302 về callbackURL + Set-Cookie phiên (tự đăng nhập)
    end
    U->>W: GET /verify-email
    W-->>U: Trang kết quả, kèm form gửi lại link
```

### AU-02 — Đăng nhập

Nguồn: `apps/api/src/auth/config.ts` (`sendOnSignIn`), `apps/api/AUTH.md`, `apps/web/features/auth/safe-callback-url.ts`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL
    participant M as Email (dev: console.log)

    Note over W,BA: AU-02 · Backend đã chạy. Màn Đăng nhập trên web đang làm
    U->>W: Nhập email, mật khẩu
    W->>A: POST /api/auth/sign-in/email (credentials include)
    A->>BA: authHandler chuyển nguyên request
    BA->>DB: Tìm users + accounts theo email, so khớp hash mật khẩu
    DB-->>BA: Kết quả
    alt Sai email hoặc mật khẩu
        BA-->>W: Lỗi theo định dạng Better Auth
        W-->>U: Báo sai thông tin đăng nhập
    else Đúng mật khẩu nhưng email chưa xác minh
        BA->>M: Gửi lại link xác minh (sendOnSignIn)
        BA-->>W: 403 EMAIL_NOT_VERIFIED
        W-->>U: Nhắc mở email, kèm lối gửi lại link
    else Hợp lệ
        BA->>DB: INSERT sessions
        BA-->>W: 200 user + Set-Cookie phiên (HTTP-only)
        W-->>U: Về trang trước đó (URL đã qua kiểm tra cùng origin)
    end
    Note over A: Auth chưa cấu hình hoặc mất DB thì trả 503 AUTH_UNAVAILABLE
```

### AU-03 — Đăng xuất

Nguồn: `apps/api/AUTH.md` (`POST /api/auth/sign-out`).

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL

    Note over W,BA: AU-03 · Backend đã chạy. Nút Đăng xuất trên web đang làm
    U->>W: Bấm Đăng xuất
    W->>A: POST /api/auth/sign-out (kèm cookie phiên)
    A->>BA: authHandler chuyển nguyên request
    BA->>DB: Thu hồi phiên hiện tại
    DB-->>BA: Xong
    BA-->>W: 200 + xoá cookie phiên
    W->>W: Xoá thông tin user đang giữ trong bộ nhớ
    W-->>U: Giao diện về trạng thái khách
```

### AU-04 — Xem tài khoản

Nguồn: `apps/api/AUTH.md` (`get-session`, `update-user`), hook `before` trong `apps/api/src/auth/config.ts`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL

    Note over W,BA: AU-04 · Backend đã chạy. Trang tài khoản trên web chưa có
    U->>W: Mở trang tài khoản
    W->>A: GET /api/auth/get-session (chuyển tiếp cookie)
    A->>BA: authHandler chuyển nguyên request
    BA->>DB: Tìm sessions + users theo token trong cookie
    DB-->>BA: Kết quả
    alt Không có phiên, hoặc phiên hết hạn
        BA-->>W: 200 null
        W-->>U: Chuyển tới trang đăng nhập
    else Có phiên
        BA-->>W: 200 session + user (id, name, email, image, emailVerified, role)
        W-->>U: Hiện thông tin tài khoản và phiên đăng nhập
    end

    opt Sửa tên hoặc ảnh đại diện
        U->>W: Gửi form hồ sơ
        W->>A: POST /api/auth/update-user (name, image)
        A->>BA: Hook before: name 1–100 ký tự, image là URL https hoặc null
        BA->>DB: UPDATE users
        BA-->>W: 200 status true
        W->>A: GET /api/auth/get-session
        A-->>W: user đã cập nhật
        W-->>U: Hiện thông tin mới
    end
```

### AU-05 — Quên / đặt lại mật khẩu

Nguồn: `apps/web/features/auth/auth-source.ts`, `apps/web/components/auth/{forgot-password-form,reset-password-form}.tsx`, `apps/api/src/auth/config.ts` (`resetPasswordTokenExpiresIn`, `revokeSessionsOnPasswordReset`).

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL
    participant M as Email (dev: console.log)

    Note over W,BA: AU-05 · Đã chạy đủ cả web lẫn backend
    U->>W: Mở /forgot-password, nhập email
    W->>A: POST /api/auth/request-password-reset (email, redirectTo cùng origin)
    A->>BA: authHandler chuyển nguyên request
    alt redirectTo không thuộc origin tin cậy
        BA-->>W: Từ chối trước khi tra cứu
        W-->>U: Báo lỗi chung
    else redirectTo hợp lệ
        BA->>DB: Tìm user theo email
        opt Email có tồn tại
            BA->>M: sendResetPassword(url), link sống 15 phút
        end
        BA-->>W: 200 status true (giống nhau dù email có tồn tại hay không)
        W-->>U: Thông báo trung tính, không lộ email có tài khoản hay không
    end

    U->>A: Mở link GET /api/auth/reset-password/:token
    A->>BA: authHandler
    alt Token sai hoặc hết hạn
        BA-->>U: 302 về /reset-password kèm error=INVALID_TOKEN
    else Token hợp lệ
        BA-->>U: 302 về /reset-password kèm token
    end

    U->>W: Nhập mật khẩu mới (8–128 ký tự)
    W->>A: POST /api/auth/reset-password (token, newPassword)
    A->>BA: authHandler
    BA->>DB: Đổi mật khẩu trong accounts, thu hồi mọi phiên khác của user
    BA-->>W: 200 status true
    W-->>U: Báo thành công, mời đăng nhập lại
```

## Nhóm: Catalog (đã có code)

### CT-07 — Xem chi tiết component

Nguồn: `apps/web/app/components/[slug]/page.tsx`, `apps/web/features/catalog/catalog-source.ts`, route `GET /components/:slug` trong `apps/api/src/index.ts`, `apps/api/src/catalog/{queries,mapper}.ts`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant DB as PostgreSQL

    Note over W,A: CT-07 · Đã chạy. Công khai, không cần đăng nhập
    U->>W: GET /components/:slug
    W->>W: getCatalogSource() chọn nguồn theo API_MODE
    alt API_MODE=mock (mặc định)
        W-->>U: Trang chi tiết dựng từ dữ liệu mock
    else API_MODE=live
        W->>A: GET /components/:slug
        A->>A: parseSlugParam kiểm tra slug kebab-case
        A->>DB: getComponentBySlug: chỉ lấy dòng is_published=true, kèm tên tác giả
        DB-->>A: Dòng dữ liệu hoặc rỗng
        alt Slug sai, không tồn tại, hoặc chưa publish
            A-->>W: 404 NOT_FOUND (khung lỗi chung, không phân biệt lý do)
            W-->>U: Trang không tìm thấy
        else Có component đã publish
            A->>A: toCatalogComponent bỏ field nội bộ (authorId, timestamps)
            A-->>W: 200 bọc trong khung item
            W-->>U: Trang chi tiết + khung xem trước animation
        end
    end
    Note over W: Lỗi đã biết: web chưa bóc khung item nên chế độ live đang hỏng
    Note over A: Chưa cấu hình DATABASE_URL thì trả 503 DATABASE_UNCONFIGURED
```

### SE-01 — Tạo listing (bản nháp)

Nguồn: route `POST /admin/components` + `adminGuard` trong `apps/api/src/index.ts`, `apps/api/src/auth/guards.ts` (`requireAuth`, `requireRole`), `apps/api/src/catalog/admin-queries.ts` (`insertComponent`, `findUniqueSlug`). Sơ đồ này cũng là sơ đồ **phân quyền** của hệ thống: mọi route admin đi qua đúng hai lớp guard này.

```mermaid
sequenceDiagram
    autonumber
    actor AD as Admin
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL

    Note over W,A: SE-01 · API đã chạy, chỉ admin được đăng. Màn Admin trên web chưa có
    AD->>W: Nhập tên, mô tả, category, tags, version
    W->>A: POST /admin/components (kèm cookie phiên)
    A->>BA: requireAuth gọi auth.api.getSession
    BA->>DB: Tìm sessions + users theo cookie
    DB-->>BA: Kết quả
    BA-->>A: session hoặc null
    alt Không có phiên
        A-->>W: 401 UNAUTHENTICATED
    else Có phiên nhưng role khác admin
        A-->>W: 403 FORBIDDEN (requireRole so khớp chính xác, không kế thừa)
    else role = admin
        A->>A: parseCreateComponentRequest
        alt Body sai hợp đồng
            A-->>W: 422 VALIDATION_BODY
        else Body hợp lệ
            A->>DB: findUniqueSlug: thử slug, rồi slug-2, slug-3 khi trùng
            A->>DB: INSERT components (is_published=false, author_id = admin)
            alt Trùng slug do hai request cùng lúc
                DB-->>A: Lỗi unique 23505
                A-->>W: 409 SLUG_CONFLICT
            else Ghi thành công
                A->>DB: getComponentAnyStatus đọc lại dòng vừa tạo
                DB-->>A: Dòng dữ liệu
                A-->>W: 201 item ở trạng thái nháp
                W-->>AD: Hiện listing nháp
            end
        end
    end
    Note over A,DB: Publish là bước riêng: POST /admin/components/:slug/publish
```

## Nhóm: Membership (dự kiến)

Ba sơ đồ dưới thay cho CM-01→03 kiểu "mua từng component". Chúng mô tả đề xuất trong RFC-02 (`docs/rfcs/membership.md`, PR #132) — **chưa có bảng, contract hay route nào**; tên endpoint và mã lỗi có thể đổi khi RFC được duyệt.

### CM-01 — Đăng ký gói Pro

Nguồn: RFC-02 mục 6 (API đề xuất) và mục 8 (provider `mock` cho giai đoạn đồ án).

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant P as Cổng thanh toán (dự kiến: mock)
    participant DB as PostgreSQL

    Note over U,DB: CM-01 · DỰ KIẾN theo RFC-02 membership, chưa có code
    U->>W: Mở trang Bảng giá, chọn Pro theo tháng hoặc năm
    W->>A: POST /membership/checkout (interval)
    A->>A: requireAuth
    alt Chưa đăng nhập
        A-->>W: 401 UNAUTHENTICATED
        W-->>U: Chuyển tới trang đăng nhập
    else Đã đăng nhập
        A->>P: Tạo phiên thanh toán
        P-->>A: checkoutUrl + mã tham chiếu
        A-->>W: 200 checkoutUrl
        W-->>U: Chuyển sang trang thanh toán
        U->>P: Xác nhận thanh toán
        P->>A: POST /membership/webhook (có chữ ký)
        A->>A: Xác thực chữ ký webhook
        A->>DB: Ghi subscriptions (plan=pro, status=active, current_period_end)
        DB-->>A: Xong
        A-->>P: 200
        P-->>U: Chuyển về web
        U->>W: Trang xác nhận đăng ký thành công
    end
    Note over A,DB: Quyền Pro chỉ bật khi webhook ghi xong, không dựa vào redirect của trình duyệt
```

### CM-02 — Xem trạng thái gói

Nguồn: RFC-02 mục 3.2 (quy tắc "còn hiệu lực") và mục 6.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant DB as PostgreSQL

    Note over U,DB: CM-02 · DỰ KIẾN theo RFC-02 membership, chưa có code
    U->>W: Mở trang tài khoản, mục Gói của tôi
    W->>A: GET /me/membership (kèm cookie phiên)
    A->>A: requireAuth
    A->>DB: Tìm subscription chưa expired của user
    DB-->>A: Một dòng hoặc rỗng
    alt Không có, hoặc current_period_end đã qua
        A-->>W: 200 plan=free
        W-->>U: Hiện gói Free + lối nâng cấp
    else Còn hiệu lực (status active hoặc canceled)
        A-->>W: 200 plan=pro, status, currentPeriodEnd
        W-->>U: Hiện gói Pro và ngày hết hạn
    end

    opt Tắt gia hạn
        U->>W: Bấm Huỷ gia hạn
        W->>A: POST /membership/cancel
        A->>DB: UPDATE subscriptions SET status=canceled
        A-->>W: 200
        W-->>U: Báo vẫn dùng Pro tới hết kỳ đã trả
    end
```

### CM-03 — Cài component Pro

Nguồn: RFC-02 mục 3.2–3.3 và mục 8 (cách CLI chứng minh quyền còn mở).

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant C as CLI (npx luva-ui add)
    participant A as API (Express)
    participant DB as PostgreSQL

    Note over U,DB: CM-03 · DỰ KIẾN theo RFC-02 membership, chưa có code
    U->>C: Chạy lệnh cài một component
    C->>A: GET /components/:slug/install (cách CLI chứng minh danh tính còn mở)
    A->>DB: Tìm component đã publish theo slug
    DB-->>A: Dòng dữ liệu hoặc rỗng
    alt Không tồn tại hoặc chưa publish
        A-->>C: 404 NOT_FOUND
        C-->>U: Báo không tìm thấy
    else access_tier = free
        A-->>C: 200 dữ liệu cài đặt
        C-->>U: Chép mã nguồn vào dự án
    else access_tier = pro
        A->>A: Xác định người gọi
        alt Chưa xác thực
            A-->>C: 401 UNAUTHENTICATED
            C-->>U: Hướng dẫn đăng nhập
        else Đã xác thực
            A->>DB: Tìm subscription Pro còn hiệu lực của user
            DB-->>A: Một dòng hoặc rỗng
            alt Không có gói Pro còn hiệu lực và không phải admin
                A-->>C: 403 MEMBERSHIP_REQUIRED
                C-->>U: Hướng dẫn nâng cấp gói
            else Pro còn hiệu lực, hoặc là admin
                A-->>C: 200 dữ liệu cài đặt bản mới nhất
                C-->>U: Chép mã nguồn vào dự án
            end
        end
    end
    Note over U,C: Code đã cài nằm trong dự án người dùng, vẫn dùng được sau khi gói hết hạn (MIT)
```

## Nhóm: Cộng đồng và Chat (dự kiến)

Năm sơ đồ dưới bám theo `docs/COMMUNITY_ARCHITECTURE.md` (§6.3, §7, §8.2) và RFC-01 (`docs/rfcs/community-chat-shared-contracts.md`). RFC-01 còn **PENDING REVIEW** (issue #68) và chưa có dòng code nào cho forum/chat.

### FR-06 — Xem thread + trả lời

Nguồn: `COMMUNITY_ARCHITECTURE.md` §7.1, RFC-01 (giới hạn 50 reply ở trang đầu).

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web (Next.js)
    participant A as API (Express)
    participant DB as PostgreSQL

    Note over U,DB: FR-06 · DỰ KIẾN theo COMMUNITY_ARCHITECTURE + RFC-01, chưa có code
    U->>W: Mở một thread trong Cộng đồng
    W->>A: GET /community/threads/:id
    A->>A: threadIdParamSchema kiểm tra id là uuid
    A->>DB: Lấy forum_threads kèm tác giả công khai và category
    DB-->>A: Thread hoặc rỗng
    alt Không tồn tại
        A-->>W: 404 NOT_FOUND (khung lỗi chung)
        W-->>U: Trang không tìm thấy
    else Có thread
        A->>DB: Lấy forum_replies theo thread_id, cũ trước, tối đa 50 dòng
        DB-->>A: Danh sách reply
        A-->>W: 200 thread + replies (reply được chấp nhận luôn có mặt)
        W->>W: Render Markdown qua bộ lọc an toàn, dựng cây reply tới 4 cấp
        W-->>U: Trang thread và các trả lời
        opt Thread có hơn 50 reply
            W->>A: GET /community/threads/:id/replies (page, pageSize, sort)
            A->>DB: Lấy trang reply kế tiếp
            A-->>W: 200 trang reply
            W-->>U: Nối thêm reply
        end
    end
    Note over A: Công khai, khách cũng đọc được
```

### FR-07 — Tạo thread

Nguồn: `COMMUNITY_ARCHITECTURE.md` §7.1 + §8.2 (rate limit, anti-spam), RFC-01 (`createThreadSchema`, bảng khớp threadType ↔ category).

```mermaid
sequenceDiagram
    autonumber
    actor U as Thành viên
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL

    Note over U,DB: FR-07 · DỰ KIẾN theo COMMUNITY_ARCHITECTURE + RFC-01, chưa có code
    U->>W: Nhập tiêu đề, nội dung, chọn category và loại thread
    W->>A: POST /community/threads (title, body, categorySlug, threadType, componentSlug, tags)
    A->>BA: requireAuth gọi getSession
    BA-->>A: session hoặc null
    alt Chưa đăng nhập
        A-->>W: 401 UNAUTHENTICATED
        W-->>U: Chuyển tới trang đăng nhập
    else Vượt giới hạn 5 thread trong 10 phút
        A-->>W: 429 RATE_LIMITED
        W-->>U: Báo thử lại sau
    else Được phép ghi
        A->>A: createThreadSchema: title 8–160, body 20–20000, tối đa 2 link
        A->>DB: Tìm forum_categories theo categorySlug
        DB-->>A: Category hoặc rỗng
        alt Body sai, hoặc threadType không khớp category
            A-->>W: 400 VALIDATION_ERROR
            W-->>U: Chỉ ra trường sai
        else Hợp lệ
            A->>DB: INSERT forum_threads (slug do server sinh, author_id từ phiên)
            DB-->>A: Thread mới
            A-->>W: 201 thread
            W-->>U: Chuyển tới trang thread vừa tạo
        end
    end
    Note over A: Quy tắc khớp: help=question, ideas=idea, showcase=showcase, feedback=feedback, announcements=announcement
```

### FR-09 — Trả lời lồng nhau (tối đa 4 cấp)

Nguồn: `COMMUNITY_ARCHITECTURE.md` §6.3 (reply + counter trong một transaction), RFC-01 (`createReplySchema`, depth 0..4).

```mermaid
sequenceDiagram
    autonumber
    actor U as Thành viên
    participant W as Web (Next.js)
    participant A as API (Express)
    participant BA as Better Auth
    participant DB as PostgreSQL

    Note over U,DB: FR-09 · DỰ KIẾN theo COMMUNITY_ARCHITECTURE + RFC-01, chưa có code
    U->>W: Viết trả lời cho thread hoặc cho một reply khác
    W->>W: Sinh clientMessageId cho lần gửi này
    W->>A: POST /community/threads/:id/replies (body, parentReplyId, clientMessageId)
    A->>BA: requireAuth gọi getSession
    BA-->>A: session hoặc null
    alt Chưa đăng nhập
        A-->>W: 401 UNAUTHENTICATED
    else Vượt giới hạn 15 reply trong 10 phút
        A-->>W: 429 RATE_LIMITED
    else Được phép ghi
        A->>DB: BEGIN
        opt Có parentReplyId
            A->>DB: Đọc reply cha: thread_id và depth
            DB-->>A: Reply cha
        end
        alt Reply cha thuộc thread khác, hoặc depth cha lớn hơn 3
            A->>DB: ROLLBACK
            A-->>W: 400 VALIDATION_ERROR
            W-->>U: Báo không thể trả lời sâu hơn 4 cấp
        else Hợp lệ
            A->>DB: INSERT forum_replies (depth = depth cha + 1, tối đa 4)
            A->>DB: UPDATE forum_threads: reply_cache + 1, last_activity_at = now()
            A->>DB: COMMIT
            A-->>W: 201 reply
            W-->>U: Chèn reply vào đúng nhánh
        end
    end
    Note over A,DB: Ghi reply và tăng bộ đếm nằm chung một transaction, không dùng trigger
```

### CH-03 — Gửi / nhận tin nhắn realtime

Nguồn: `COMMUNITY_ARCHITECTURE.md` §6.3 (idempotency theo `clientMessageId`), §7.3–7.4 (event `ack`, `message.created`, WebSocket `/ws/chat`), §8.2 (rate limit).

```mermaid
sequenceDiagram
    autonumber
    actor U as Người gửi
    participant W1 as Web người gửi
    participant WS as API WebSocket /ws/chat
    participant DB as PostgreSQL
    participant W2 as Web người xem khác

    Note over U,W2: CH-03 · DỰ KIẾN theo COMMUNITY_ARCHITECTURE + RFC-01, chưa có code
    W1->>WS: Upgrade /ws/chat (kèm cookie phiên)
    WS->>WS: Kiểm tra phiên Better Auth lúc upgrade, khách chỉ được đọc
    W2->>WS: Upgrade /ws/chat, theo dõi cùng channel
    U->>W1: Gõ tin nhắn rồi gửi
    W1->>W1: Sinh clientMessageId, hiện tin ở trạng thái đang gửi
    W1->>WS: send (channelId, body tối đa 2000 ký tự, clientMessageId)
    alt Người gửi là khách
        WS-->>W1: error UNAUTHENTICATED
    else Vượt giới hạn 20 tin trong 10 giây
        WS-->>W1: error RATE_LIMITED
    else Được phép gửi
        WS->>DB: INSERT chat_messages, bỏ qua nếu trùng (channel_id, client_message_id)
        opt Không có dòng mới vì đây là lần gửi lại
            WS->>DB: Đọc tin đã lưu trước đó
        end
        DB-->>WS: message kèm id và seq
        WS-->>W1: ack (refClientMessageId, message)
        WS-->>W2: message.created (message)
        W1-->>U: Tin chuyển sang đã gửi
        W2->>W2: Bỏ trùng theo message.id, xếp theo seq
    end
    Note over WS,DB: PostgreSQL là nguồn chân lý, WebSocket chỉ là kênh phát
```

### CH-05 — Kết nối lại và tiếp tục

Nguồn: `COMMUNITY_ARCHITECTURE.md` §6.3 (`seq` là con trỏ tuyệt đối), §7.3 (heartbeat 30s, backoff, `resume.afterSeq`), §7.4.

```mermaid
sequenceDiagram
    autonumber
    actor U as Thành viên
    participant W as Web (Next.js)
    participant WS as API WebSocket /ws/chat
    participant DB as PostgreSQL

    Note over U,DB: CH-05 · DỰ KIẾN theo COMMUNITY_ARCHITECTURE + RFC-01, chưa có code
    Note over W,WS: Server ping/pong mỗi 30 giây để phát hiện rớt kết nối
    WS--xW: Mất kết nối
    W-->>U: Báo đang kết nối lại
    loop Thử lại với khoảng chờ 1s, 2s, ... tối đa 30s, có jitter
        W->>WS: Upgrade /ws/chat (kèm cookie phiên)
    end
    WS-->>W: Kết nối lại thành công
    W->>WS: resume (afterSeq = seq lớn nhất đã nhận)
    WS->>DB: Lấy chat_messages có seq lớn hơn afterSeq, xếp theo seq
    DB-->>WS: Các tin đã lỡ
    loop Từng tin đã lỡ
        WS-->>W: message.created
    end
    Note over WS: Phát lại xong mới chuyển sang luồng trực tiếp, seq bảo đảm không trùng và đúng thứ tự
    W->>W: Bỏ trùng theo message.id

    opt Có tin đang gửi dở lúc rớt mạng
        W->>WS: send với đúng clientMessageId cũ
        WS->>DB: INSERT bị bỏ qua vì trùng, đọc tin đã lưu
        WS-->>W: ack trả về tin đã lưu, không tạo bản ghi mới
    end
    W-->>U: Lịch sử liền mạch, không thiếu, không trùng
```

## Điểm lệch giữa bảng functions và hệ thống

Phát hiện khi đối chiếu để vẽ — cần cập nhật trong Google Sheet "Danh sách
functions":

| Dòng trong bảng | Bảng đang ghi | Hệ thống thực tế / quyết định hiện hành | Đề xuất sửa |
|---|---|---|---|
| SE-00, SE-01, SE-02 | Entity = **Member** tự tạo và sửa listing | Chỉ **admin** đăng (`docs/PRODUCT.md` mục 1; `POST /admin/components` sau `requireRole('admin')`) | Đổi Entity thành Admin, hoặc gộp vào AD-03 |
| CM-01 | Checkout & Purchase — mua 1 component | Chuyển sang membership (`docs/PRODUCT.md` mục 2, RFC-02) | Đổi thành "Subscribe to Pro (Đăng ký gói Pro)" |
| CM-02 | Confirm Purchase/License | Không còn đơn mua theo component | Đổi thành "View Membership Status (Xem trạng thái gói)" |
| CM-03 | Access/Download After Purchase | Quyền cài dựa trên gói Pro còn hiệu lực | Đổi thành "Install Pro Component (Cài component Pro)" |
| AU-01 | "Hệ thống tạo tài khoản" | Còn bước **xác minh email bắt buộc** trước khi đăng nhập được | Thêm bước 3: xác minh email qua link |
| CT-05 | Chưa có tuỳ chọn sort | Contract đã có `sort` = `newest` \| `name` (`listRequestSchema`) | Ghi rõ đã có ở contract, còn thiếu ở UI |

## Lỗi và khoảng trống ghi nhận khi vẽ

- **CT-07**: `apps/web/features/catalog/catalog-source.ts` coi cả response của
  `GET /components/:slug` là component, trong khi API trả `{ item }` — chế độ
  `API_MODE=live` sẽ hỏng trang chi tiết. Sửa trong phần việc Catalog của web.
- **AU-01 / AU-05**: email xác minh và đặt lại mật khẩu mới chỉ `console.log`;
  chưa có nhà cung cấp email (ghi trong `apps/api/AUTH.md`, việc của backend).
- **Các route admin `PATCH`**: CORS preflight của API hiện chỉ cho
  `GET, POST, OPTIONS`, nên `PATCH /admin/components/:slug` gọi khác origin ở
  môi trường dev sẽ bị chặn — cần backend xử lý trước khi dựng màn Admin.
