# RFC-02 — Membership Free + Pro thay cho giá từng component

> **Trạng thái: PENDING REVIEW** — tài liệu thiết kế (docs-only), không chứa
> file `.ts` hay migration nào. Người duyệt: **Long (`@NguyenTuMinhLong`)** cho
> phần database/API, **Văn (`@DaoDungVan`)** cho phần web/contract. Chưa được
> duyệt thì không ai sửa schema, contract hay route theo RFC này.
>
> Quyết định sản phẩm đi kèm: [`docs/PRODUCT.md`](../PRODUCT.md) mục 2–3 (cập
> nhật 2026-11-11). Ý tưởng gốc: issue #110. Mọi thứ trong RFC này gắn nhãn
> **PROPOSED** trừ khi ghi rõ **EXISTING**.

## 1. Mục tiêu

Thay mô hình "mỗi component có giá riêng + trả tiền để nhận bản cập nhật" bằng
**hai gói thành viên**:

| Gói | Quyền |
|---|---|
| **Free** (mặc định) | Xem + preview mọi component. Cài component nhóm `free`. |
| **Pro** (trả theo tháng hoặc năm) | Cài mọi component, kể cả nhóm `pro`; luôn lấy bản mới nhất khi gói còn hiệu lực. |

Hệ quả: hệ thống chỉ cần trả lời **một** câu hỏi khi cài — *người này có gói
Pro còn hiệu lực không* — thay vì theo dõi ai đã mua component nào ở phiên bản
nào.

**Ngoài phạm vi RFC này:** chọn nhà cung cấp thanh toán thật, giá bán, mã giảm
giá, gói nhóm nhiều ghế, seller marketplace, và cơ chế lưu/phát hành mã nguồn
của component (xem mục 8).

## 2. Hiện trạng (EXISTING)

| Thành phần | Chi tiết | Nơi định nghĩa |
|---|---|---|
| Cột giá trên `components` | `price_amount_minor`, `price_currency`, `requires_payment_for_update` + 4 check (`components_price_amount_check`, `components_price_currency_check`, `components_price_pair_check`, `components_paid_update_price_check`) | `packages/db/src/schema.ts`, migration `0005` |
| Contract | `catalogPriceSchema`, `componentSchema.price` + `.requiresPaymentForUpdate` (tuỳ chọn), `isValidPriceFlagCombo`, hai field đó trong `createComponentRequestSchema` / `updateComponentRequestSchema` | `packages/shared/src/contracts/catalog.ts` |
| API đọc/ghi giá | mapper + admin create/patch | `apps/api/src/catalog/{queries,mapper,admin-queries}.ts` |
| Web | **Không hiển thị giá ở đâu cả**; DTO catalog phía web còn là bản tự khai, chưa có field giá | `apps/web/features/catalog/catalog-source.ts` |
| Thanh toán, đơn mua, quyền truy cập, đăng ký gói | **Không có** bảng, contract hay route nào | — |
| Vai trò | `users.role`: `user` \| `seller` \| `admin`; guard `requireAuth` + `requireRole` | `packages/db/src/schema.ts`, `apps/api/src/auth/guards.ts` |

Vì web chưa hiển thị giá và chưa có bản ghi mua hàng nào, đổi hướng lúc này
không làm mất dữ liệu người dùng.

## 3. Mô hình đề xuất (PROPOSED)

### 3.1 Nhãn truy cập của component

Mỗi component có đúng một `accessTier`: `free` hoặc `pro`. Admin đặt khi tạo
hoặc sửa. Mặc định `free`.

### 3.2 Quy tắc quyền cài đặt

```
được cài(component, user) =
     component.accessTier = 'free'
  OR user.role = 'admin'
  OR user có subscription Pro còn hiệu lực
```

"Còn hiệu lực" = `status` thuộc (`active`, `canceled`) **và**
`current_period_end > now()`. `canceled` nghĩa là đã tắt gia hạn nhưng kỳ đã
trả vẫn dùng tới hết hạn.

Membership **không phải** một giá trị của `users.role` — vai trò là phân
quyền quản trị, membership là trạng thái trả phí có thời hạn. Hai thứ tách
riêng để hết hạn gói không đụng tới phân quyền.

### 3.3 Hết hạn

Lệnh cài (`npx luva-ui add <slug>`) chép mã nguồn vào dự án của người dùng, nên
code đã cài vẫn chạy sau khi hết hạn (MIT). Hết hạn chỉ chặn **lần cài tiếp
theo** của component `pro`. Không có thao tác thu hồi nào phía người dùng.

## 4. Dữ liệu đề xuất (PROPOSED — do Long quyết định cuối)

**`components`** — thêm cột `access_tier` (enum `component_access_tier`:
`free`, `pro`; `NOT NULL DEFAULT 'free'`).

**`subscriptions`** — bảng mới:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users.id`, cascade | |
| `plan` | enum `membership_plan` (`pro`) | Free không cần bản ghi |
| `billing_interval` | enum (`month`, `year`) | |
| `status` | enum (`active`, `canceled`, `expired`) | |
| `current_period_end` | timestamptz | mốc quyết định quyền |
| `provider` | text | `mock` cho giai đoạn đồ án |
| `provider_ref` | text | mã phía nhà cung cấp, unique theo `provider` |
| `created_at`, `updated_at` | timestamptz | |

Ràng buộc đề xuất: mỗi user tối đa **một** bản ghi chưa `expired` (unique
index có điều kiện), để câu hỏi "còn hiệu lực không" luôn đọc đúng một dòng.

Danh sách gói (tên, quyền lợi, giá) là **cấu hình tĩnh trong code**, không
phải bảng — chỉ có hai gói và giá chưa chốt.

## 5. Contract đề xuất (PROPOSED — `packages/shared`, chỉ thêm, không phá)

- `componentAccessTierSchema = z.enum(['free', 'pro'])`.
- `componentSchema.accessTier` — **tuỳ chọn** trong giai đoạn chuyển tiếp
  (giống cách `price` đã được thêm), để web và API không phải ship cùng lúc.
- `membershipPlanSchema` (`id`, `name`, `intervals`, `features`) và
  `membershipSchema` (`plan: 'free' | 'pro'`, `status`, `currentPeriodEnd`).
- `price`, `requiresPaymentForUpdate`, `catalogPriceSchema`,
  `isValidPriceFlagCombo`: đánh dấu `@deprecated`, **giữ nguyên** cho tới bước
  cuối của lộ trình ở mục 7.

## 6. API đề xuất (PROPOSED)

| Method + path | Ai gọi | Kết quả |
|---|---|---|
| `GET /plans` | công khai | danh sách gói tĩnh |
| `GET /me/membership` | `requireAuth` | gói hiện tại của người gọi (`free` nếu không có subscription còn hiệu lực) |
| `POST /membership/checkout` | `requireAuth` | tạo phiên thanh toán, trả `checkoutUrl` |
| `POST /membership/webhook` | nhà cung cấp (xác thực chữ ký) | kích hoạt / gia hạn / hết hạn subscription |
| `POST /membership/cancel` | `requireAuth` | tắt gia hạn (`status = canceled`) |
| `GET /components/:slug/install` | công khai với `free`; `requireAuth` + quyền ở 3.2 với `pro` | dữ liệu cài đặt; thiếu quyền ⇒ `403 MEMBERSHIP_REQUIRED` qua `sendError` |

Lỗi đi qua envelope hiện có (`apiErrorSchema`); `MEMBERSHIP_REQUIRED` là mã
mới duy nhất. Admin create/patch nhận thêm `accessTier`.

## 7. Lộ trình chuyển đổi — additive trước

Theo quy tắc "breaking contract changes: make them additive first" của
`apps/api/AGENTS.md` và "append-only migrations" của `packages/db/AGENTS.md`:

1. **Thêm** `access_tier` (mặc định `free`) + `accessTier` tuỳ chọn trong
   contract. Chưa bỏ gì.
2. **Backfill** bằng migration có bước đếm trước (cùng kiểu preflight đã dùng
   ở các migration `0003`–`0005`): dòng có `requires_payment_for_update = true` ⇒
   `pro`; còn lại ⇒ `free`. Dòng có giá nhưng cờ `false` (trạng thái cũ mà
   `isValidPriceFlagCombo` không còn cho phép) phải được liệt kê số lượng để
   người quyết định, không tự đoán.
3. API phát `accessTier`; web chuyển sang đọc `accessTier`.
4. Thêm bảng `subscriptions` + các route ở mục 6 với provider `mock`.
5. Khi cả hai phía không còn đọc field giá: bỏ `price` /
   `requiresPaymentForUpdate` khỏi contract (thay đổi phá vỡ — cần cả hai
   owner đồng ý) rồi bỏ cột + 4 check bằng migration mới.

Mỗi bước là một task/PR riêng; bước 1–3 không cần thanh toán.

## 8. Câu hỏi còn mở

1. **Nhà cung cấp thanh toán** — Stripe / VNPay / Momo cần tài khoản merchant
   thật. Đề xuất cho đồ án: provider `mock` (trang xác nhận giả lập, kích hoạt
   ngay), giữ đúng hình dạng checkout + webhook để sau này thay provider thật
   mà không đổi contract.
2. **Giá gói Pro** theo tháng và năm — chưa có con số.
3. **CLI chứng minh quyền Pro thế nào** — token cá nhân tạo trong trang tài
   khoản, đăng nhập qua trình duyệt kiểu device flow, hay license key. Ảnh
   hưởng tới `GET /components/:slug/install`.
4. **Mã nguồn component nằm ở đâu** — hiện `components.latest_version` chỉ là
   một giá trị hiển thị, chưa có bảng release/artifact
   (`packages/db/AGENTS.md`). Endpoint cài đặt ở mục 6 chỉ có ý nghĩa sau khi
   có task phân phối phiên bản riêng.
5. **Vai trò `seller`** trong enum `user_role` — không dùng trong mô hình này;
   giữ hay bỏ là quyết định riêng, không thuộc RFC.

## 9. Ảnh hưởng tới web (phần của Văn)

- Trang **Bảng giá** (`/pricing`) và nhãn **Pro** trên card/chi tiết — dựng
  bằng dữ liệu mock qua `features/membership/membership-source.ts`, chỉ sau
  khi bước 1 của mục 7 có contract trong `packages/shared`.
- Trang tài khoản hiển thị gói hiện tại (đọc `GET /me/membership` khi có).
- Không có nút thanh toán thật cho tới khi bước 4 xong.
