# CodeRabbit — AI code review (free OSS) — runbook & billing guard

Mục tiêu: bot review code trên mỗi PR, chạy **100% miễn phí** trên repo
public này, và **tuyệt đối không auto-charge** (tự động tính phí).

## Vì sao KHÔNG thể bị tự động tính tiền (căn cứ chính thức, 2026-10)

Nguồn: `docs.coderabbit.ai/management/plans.md` + FAQ + `/oss` (truy cập
2026-10-26).

| Sự thật chính thức | Ý nghĩa với ta |
|---|---|
| Plan **Open source**: "Unlimited public repositories, **no credit card required**" — Team features free cho repo public | Repo này PUBLIC ⇒ đủ điều kiện plan OSS |
| Trial mặc định 14 ngày (Advanced): "Organizations that do not subscribe **revert to Free**" | Trial hết hạn **tự về Free — không tự thành tiền** |
| Bật **usage-based reviews** (tính tiền theo usage): "**requires a valid payment method** before paid activation" | KHÔNG nhập card ⇔ không thể bị charge |
| Deep Scan / Agent minutes (on-demand, billed riêng) | Ta KHÔNG bật / không dùng → $0 |

**Điểm bị khóa duy nhất của chuỗi này là card.** Chỉ cần không nhập phương
thức thanh toán ở `app.coderabbit.ai`, về mặt kỹ thuật không có đường nào
bị tính tiền. File config `.coderabbit.yaml` trong repo không can thiệp
billing — nó chỉ tinh chỉnh nội dung review.

## Install (owner làm — cần quyền admin org, ~2 phút)

1. Link chuẩn: <https://app.coderabbit.ai/login> (Sign in with GitHub →
   chọn org `longvan-startup`) — hoặc <https://github.com/apps/coderabbitai>
   → Install.
2. **Chỉ grant repo này** (`Only select repositories` →
   `longvan-startup/component-marketplace`) — KHÔNG chọn "All repositories"
   (giới hạn phạm vi, đề phòng sau này thêm repo private).
3. Accept permissions (read contents/PR/issues, write PR comments).
   Onboarding **không yêu cầu card** — không nhập card là đủ.

## Sau khi install — checklist xác minh

1. **Config được nhận**: trên 1 PR comment `@coderabbitai config` — bot in
   ra config đang áp dụng (phải thấy `profile: chill`,
   `enable_free_tier: true`).
2. **Review hoạt động**: trên PR đó comment `@coderabbitai review`.
   Repo **<10 stars** ⇒ review trigger bằng tay là đúng chính sách
   free-OSS; sau khi repo ≥10 stars, auto-review tự chạy
   (`.coderabbit.yaml` giữ `auto_review.enabled: true`).
   Kỳ vọng: bot post **walkthrough comment** + review status.
3. **Chứng minh free** (`app.coderabbit.ai` → **Subscription & Billing**):
   - Plan hiển thị = **Open source** (hoặc Free trong trial);
   - **Payment methods = trống** — không có card nào được lưu;
   - **Usage-based reviews = OFF** (không bật addon trả phí);
   - PR comment/summary không có nhãn "usage-priced".
4. **GitHub org billing** (`Settings → Billing → Marketplace plans`) —
   không xuất hiện CodeRabbit với giá tiền.

## Nếu cần ngắt hoàn toàn

- `app.coderabbit.ai → Subscription` — có thể **Cancel trial** bất kỳ lúc
  nào (không mất gì của free tier); không nhập card từ đầu thì không bao
  giờ có hoá đơn để lo.
- Gỡ app: GitHub → org settings → GitHub Apps → Configure CodeRabbit →
  **Uninstall**.

## Trọng tâm review của bot (đã cấu hình trong `.coderabbit.yaml`)

- `apps/api/**` — envelope/Drizzle/không log secret/không import `apps/web`.
- `apps/web/**` — GSAP chỉ qua `lib/gsap.ts`, types từ
  `@marketplace/shared`, không import `packages/db`.
- `packages/**` — exports của shared là API public (additive-only);
  migrations forward-only (flag khi ai chỉnh file migration cũ).
- `.github/workflows/**` — unpinned actions, secret lộ, đổi tên required
  check.
- Loại công cụ trùng CI: markdownlint / languagetool **tắt**; biome,
  shellcheck, gitleaks, actionlint, zizmor, squawk (migration SQL) bật.

## Bảo mật & dữ liệu

- CodeRabbit là **SaaS dịch vụ AI**: nó nhận code diff của PR thông qua app
  install. Repo public, không secret trong source (đã enforce gitleaks)
  ⇒ rủi ro thấp. Quy tắc cứng: không bao giờ paste secret vào PR — bot
  đọc diff và chỉ authorities nó nhận được từ repo.
- Khi trang app hiện banner "Update permissions" → owner rà lại trước khi
  chấp nhận (giữ nguyên tắc least-privilege).
