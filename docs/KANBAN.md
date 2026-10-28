# Kanban — Marketplace Board (org Projects v2)

Hệ thống quản lý công việc: **1 org project duy nhất** chứa mọi issue của repo,
lifecycle tự động nhờ các bot sẵn có. Tài liệu này là runbook ~2 phút cho owner.

```text
Bot vòng đời (đã live):
  CI/CD đỏ trên main  → auto-issue.yml        → tự MỞ issue (run-link/sha/job hỏng)
  CI/CD xanh trở lại  → auto-issue.yml        → tự comment + ĐÓNG
  PR merge fixes #n   → auto-close-issues.yml → tự comment + ĐÓNG issue
  Issue mở / mở lại   → auto-add-to-project.yml → thêm vào Marketplace Board
```

## 1. Owner setup (làm một lần — ~2 phút)

Các GraphQL mutate trong phần dưới cần token có scope `project`
(classic PAT: tick `project`). Token `gh` hiện tại đi với đề dùng
`repo / read:org / workflow` — đã thử createProjectV2 và nhận
`INSUFFICIENT_SCOPES` (verified 2026-10-26) — nên bước này là owner-manual.
Link grant: <https://github.com/settings/tokens>.

1. Tạo org project: <https://github.com/organizations/longvan-startup/projects>
   → **New project** → Title `Marketplace Board` (template **Board**).
2. Chạy helper dưới đây (token scope-project đặt vào biến `$PROJECT_TOKEN`;
   nếu project đã tạo ở bước 1 thì bỏ mutation `createProjectV2`, dùng
   `owner.projects` query để lấy id):

   ```bash
   # Lấy node id org + project (organisation projects cần scope project)
   ORG_ID=$(gh api orgs/longvan-startup --jq .node_id)
   PROJECT_ID=$(gh api graphql -H "Authorization: token $PROJECT_TOKEN" \
     -f query="mutation { createProjectV2(input:{ ownerId: \"$ORG_ID\", title: \"Marketplace Board\" }) { projectV2 { id url } } }" \
     --jq '.data.createProjectV2.projectV2.id')

   # Repo node id (repo item) không cần — cố định project qua UI/Workflows.
   echo "PROJECT_ID=$PROJECT_ID"
   ```

3. Trên UI project: **··· (project menu) → Workflows → Add repository item**
   → chọn repo `longvan-startup/component-marketplace`, filter: `is issue`.
4. Đặt **repo variable** để bot chạy độc lập token riêng (lệnh chỉ để lấy id
   project làm biến):

   ```bash
   gh variable set KANBAN_PROJECT_NODE_ID \
     --repo longvan-startup/component-marketplace --body "$PROJECT_ID"
   ```

5. (Tuỳ chọn) Nếu GITHUB_TOKEN gốc bị chặn org-level projects: tạo secret
   `PROJECT_BOARD_TOKEN` bằng PAT scope `project` — bot dùng nó trước
   (path A trong workflow). Bot được thiết kế **fail-soft**: thiếu token ⇒
   run vẫn xanh, issue được thêm tay (§4).

## 2. Cột kanban khuyến nghị

Giữ chuẩn đơn giản, matching lifecycle bot (không overengineering):

| Cột (field `Status` mặc định) | Nghĩa |
|---|---|
| `Todo` | issue mới (bot thêm; hoặc owner thêm tay) |
| `In Progress` | ai đó đang code |
| `In Review` | PR đã mở, chờ review |
| `Done` | issue bot auto-close hoặc owner đóng |

Bot **không** auto-di chuyển cột: việc chuyển `Status` bằng tay đủ cho
team-2-people; auto-transition sẽ cần lại khi thêm Wave-2 nếu thật sự mất
thời gian (đánh giá lại sau #31).

## 3. Verification

1. Mở một issue thử nghiệm (scope nhỏ, label `task`).
2. Run `Auto add to project` trong tab Actions phải SUCCESS (hoặc skip sạch
   nếu §1.4/§1.5 chưa làm — log ghắc lỗi `warning`, run không đỏ).
3. Issue xuất hiện trên `Marketplace Board`.
4. Đóng issue → nó nằm bên cột Done/view đúng theo filter `State: open`.
5. Tính tổng: `gh api graphql … listProjectV2Items` hoặc mở URL project.

## 4. Manual fallback (khi §1 chưa hoàn thành)

Bot skip ⇒ owner chỉ cần mở project → **+ Add items** → gõ số issue.
Không có code hoặc sửa CI nào cần — board vẫn trung tâm và trung thực.

Backlog import (issues tạo TRƯỚC khi board có workflows chỉ bắt item mới):
chạy 1 lệnh duy nhất sau khi có PAT scope `project`:

```bash
PROJECT_ID=PVT_xxx BOARD_TOKEN=ghp_xxx bash scripts/board-add-issues.sh
```

Script idempotent (re-run skip item sẵn đã có), in bảng `ADD/SKIP/ERROR`
đủ rõ, và KHÔNG đụng status/cột — việc kéo item sang `In Progress` /
`In Review` / `Done` là thao tác tay của team theo quan điểm §2.
