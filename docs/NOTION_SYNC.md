# Notion sync — setup

Tự xây (phương án B, chốt ngày 2026-11-09) thay cho Notion "Database sync"
chính chủ, vì 2 lý do đã kiểm chứng trên [notion.com/help/github](https://www.notion.com/help/github)
(2026-11-09): tính năng đó **chỉ có trên gói Business** (`"GitHub sync isn't
available on other plans"`), và nó **không gửi thông báo gì cả** — chỉ là 1
database tự refresh, phải tự mở Notion mới biết có gì mới.

Cách này: 1 GitHub Action (`.github/workflows/notion-sync.yml`) gọi thẳng
Notion API khi issue/PR thay đổi — ghi/update 1 row trong database Notion của
bạn, và khi có review-request/assign/merge thì **comment @mention đúng
người** trên row đó (đây chính là cơ chế tạo thông báo thật của Notion, gói
nào cũng dùng được, không cần Business).

## 1. Tạo Notion internal integration (tự làm, tôi không tạo thay được)

1. Notion → Settings → Connections → "Develop or manage integrations" →
   **New integration**. Loại "Internal". Workspace: Component-Marketplace
   Team Workspace.
2. Copy **Internal Integration Secret** (dạng `secret_...` hoặc `ntn_...`) —
   đây là giá trị cho secret `NOTION_API_TOKEN` ở bước 4.

## 2. Tạo database đích, đúng tên + kiểu property

Tạo 1 database (table) mới trong workspace, đặt tên tuỳ ý, với **đúng** các
property sau (tên và kiểu phải khớp chính xác — script build request theo
đúng tên này):

| Property | Kiểu |
|---|---|
| `Name` | Title (mặc định có sẵn) |
| `Type` | Select — thêm 2 option: `Issue`, `Pull Request` |
| `Repo` | Text |
| `Number` | Number |
| `State` | Select — thêm option khi cần: `open`, `closed`, `merged`, `draft` |
| `URL` | URL |
| `Labels` | Multi-select (để trống option, script tự tạo theo tên label GitHub) |
| `Author` | Text |
| `Assignee` | Text — danh sách GitHub login được assign, cách nhau bởi `, `; `—` nếu chưa ai |
| `Updated At` | Date |

Mở database → `...` (góc trên phải) → **Connections** → add integration vừa
tạo ở bước 1. Thiếu bước này thì API trả 404 dù token đúng.

Copy **database ID** từ URL trang database:
`notion.so/<workspace>/<DATABASE_ID>?v=...` (chuỗi 32 ký tự hex, bỏ dấu `-`
nếu URL có). Đây là giá trị cho biến `NOTION_DATABASE_ID` ở bước 4.

## 3. Lấy Notion user ID của Long và Văn (chỉ cần cho phần @mention)

Không có cách tra cứu "GitHub login → Notion user ID" tự động ở đây — tự
map tay 1 lần. Cách lấy user ID: trong Notion, `@mention` chính người đó ở
bất kỳ đâu → hover/click vào mention → copy link, dạng
`notion.so/<page>#<USER_ID>` hoặc dùng API `GET /v1/users` với token ở bước 1
(trả danh sách thành viên workspace kèm `id`).

## 4. Thêm vào GitHub repo

Settings → Secrets and variables → Actions:

| Loại | Tên | Giá trị |
|---|---|---|
| Secret | `NOTION_API_TOKEN` | integration secret ở bước 1 |
| Secret | `NOTION_GITHUB_USER_MAP` | JSON 1 dòng, vd `{"DaoDungVan":"<user-id-van>","NguyenTuMinhLong":"<user-id-long>"}` — để secret (không phải variable) vì đây là định danh nội bộ thành viên, repo đang public |
| Variable | `NOTION_DATABASE_ID` | database ID ở bước 2 — không nhạy cảm, để variable cho dễ xem lại |

Thiếu `NOTION_API_TOKEN` hoặc `NOTION_DATABASE_ID` ⇒ workflow tự skip có ghi
chú (`::notice::`), không fail, không có hành vi "demo mode" nào thay thế.

## Hành vi

- Mọi action của `issues`/`pull_request` trong `on:` của workflow đều đồng bộ
  1 row (tạo nếu chưa có row khớp `Repo`+`Number`+`Type`, update nếu đã có —
  không bao giờ tạo trùng).
- Issue/PR **đóng hoặc merge** ⇒ row bị archive (vào thùng rác Notion) ngay sau
  khi sync xong — database chỉ hiện đúng cái đang mở, không cần tự xoá tay.
  Mở lại issue/PR đó sau này sẽ tạo row mới (không khôi phục row cũ đã archive
  — API Notion không query ra page đã archive).
- Cột `Assignee` luôn phản ánh danh sách assignee **hiện tại** của issue/PR đó
  (từ payload GitHub `assignees`), không chỉ người vừa được assign ở event này.
- Có 4 trường hợp thêm comment @mention — nội dung mô tả rõ việc cần làm thay
  vì chỉ ping suông, để không mơ hồ như title email GitHub:
  - `assigned` (issue hoặc PR): `"Bạn được phân công: Issue/PR #N "<title>" — cần xem/xử lý"`
  - `review_requested` (PR): `"Bạn được yêu cầu review: PR #N "<title>""`
  - PR đóng với `merged=true`: `"PR #N "<title>" đã merge"` (ping tác giả PR)

  Mọi action khác chỉ sync, không ping.
- GitHub login không có trong `NOTION_GITHUB_USER_MAP` ⇒ vẫn sync row bình
  thường, chỉ bỏ qua bước comment (ghi `::notice::`, không fail workflow).
- PR comment/review nội dung **không** được sync — đúng giới hạn của Notion
  Comments API (không đọc được review comment GitHub), chỉ sync metadata.

## Test

`bun test scripts/notion-sync.test.ts` — toàn bộ test dùng `fetchImpl` giả,
không gọi Notion thật. Chạy thử với API thật: tạo 1 PR/issue nháp sau khi đã
cấu hình đủ 3 giá trị ở bước 4, xem Actions tab job "Notion sync".

## Backfill issue/PR có sẵn (chạy 1 lần)

Workflow chỉ bắt event `issues`/`pull_request` mới từ lúc merge trở đi — issue/PR
có từ trước đó không tự thêm vào Notion. `scripts/notion-backfill.mjs` quét các
issue/PR **đang mở** (không lấy lịch sử đã đóng/merged) qua GitHub REST API rồi
upsert vào Notion qua đúng code dùng chung với `notion-sync.mjs` — không gửi
comment @mention (ping hàng loạt cho hoạt động cũ là spam, không phải thông báo).

Chạy thủ công, 1 lần, không phải GitHub Action:

```bash
GITHUB_TOKEN=<gh-token-có-quyền-đọc-repo> \
GITHUB_REPOSITORY=longvan-startup/component-marketplace \
NOTION_API_TOKEN=<token-ở-bước-1> \
NOTION_DATABASE_ID=<id-ở-bước-2> \
bun scripts/notion-backfill.mjs
```

Thiếu 1 trong 4 biến ⇒ skip có ghi chú, không chạy nửa chừng. Test:
`bun test scripts/notion-backfill.test.ts`.
