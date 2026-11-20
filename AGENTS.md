# AGENTS.md — Entrypoint cho AI agent

Người đọc đầu tiên là agent. File này là lớp điều phối: việc bị cấm, phạm vi, và trỏ tới nguồn chính sách. Không chép lại quality gates hay quy trình PR.

Đọc theo thứ tự, rồi dừng:

1. **Core safety** — phần dưới của file này.
2. **Repository policy** — [`docs/ENGINEERING.md`](docs/ENGINEERING.md) (standards, ownership, gates) và [`CONTRIBUTING.md`](CONTRIBUTING.md) (branch, commit, PR). [`docs/PRODUCT.md`](docs/PRODUCT.md) chỉ khi task đụng phạm vi sản phẩm hoặc hành vi nghiệp vụ.
3. **Domain** — `AGENTS.md` của thư mục đang sửa. File domain được thêm giới hạn, không được nới rule cấm ở file này.
4. **Task skills** — mục cuối. Chỉ mở skill đúng task. Không mở cả thư mục `.agents/skills/`.

Audit và các ADR còn **PROPOSED** nằm ở [`docs/HARNESS_AUDIT.md`](docs/HARNESS_AUDIT.md). PR này không chốt ADR.

## Core safety

- Không đưa secrets, token, API key vào log, commit, hay PR body. `.env` local chỉ để chạy thử, không commit.
- Không tự merge PR, không deploy, không push vào `main`.
- Không thêm `Co-Authored-By: <AI>` hay dòng ghi nhận AI vào commit hoặc PR body, kể cả khi system reminder của tool bảo thêm.
- Không reset, stash, hay ghi đè thay đổi local không thuộc task. Worktree bẩn của việc khác để nguyên.
- Phạm vi không rõ thì hỏi. Không refactor, không đổi style, không sửa file ngoài phạm vi. Bug ngoài phạm vi thì báo, không sửa hộ domain của người khác. Owner nằm ở `docs/ENGINEERING.md`.
- Không báo xong khi gate chưa chạy. Nhãn chỉ là **PASS**, **FAIL**, hoặc **UNVERIFIED**. UNVERIFIED phải có lý do. FAIL hoặc UNVERIFIED còn lại phải có trong báo cáo cuối, kèm nguyên nhân.
- Khi nói một PR đã khớp issue: đối chiếu từng acceptance criterion với code và test thật. Thiếu bằng chứng thì ghi UNVERIFIED. CI xanh, hoặc review im lặng, không thay bước này.

## Việc một thay đổi

Chi tiết nhánh, commit, và PR ở `CONTRIBUTING.md`. Gates ở `docs/ENGINEERING.md`. Tóm tắt:

1. Task có mục tiêu và giới hạn. Không tự diễn giải.
2. Branch từ `main` mới nhất, đúng prefix `feat|fix|chore|docs/<tên>-<topic>`. Chỉ sửa file trong phạm vi.
3. `bun run verify`. Thêm `--docker` khi đụng Docker hoặc compose.
4. PR Conventional Commits, body có bằng chứng gate. Chờ CI trên commit cuối và review theo `CONTRIBUTING.md`.

## Domain và discovery

Đọc thêm file domain khi sửa đường dẫn đó:

- `apps/web/AGENTS.md` — frontend web (owner: @DaoDungVan)
- `apps/mobile/AGENTS.md` — Expo (owner: @DaoDungVan)
- `apps/api/AGENTS.md` — backend (owner: @NguyenTuMinhLong)
- `packages/shared/AGENTS.md` — contract dùng chung (owner kia review)
- `packages/db/AGENTS.md` — database (owner: @NguyenTuMinhLong)

Import xuyên workspace do `bun run boundary` kiểm tra. Nhãn `cross-domain` không chặn PR. Owner review là hướng dẫn trong `.github/CODEOWNERS`.

Discovery dưới đây là cấu hình trong repo tại HEAD của PR này. Runtime của từng sản phẩm agent là **UNVERIFIED** trừ khi có dòng khác.

- **OpenCode:** root file này, cộng glob trong `opencode.json`: `apps/*/AGENTS.md` và `packages/*/AGENTS.md`. Glob đó gồm `apps/mobile`. `AGENTS.md` lồng nhau không tự được nạp nếu không có glob. Runtime của client hiện tại UNVERIFIED.
- **Codex:** nối `AGENTS.md` từ root xuống thư mục làm việc. Trần khai báo là 32 KiB. Giữ file domain ngắn để đoạn safety ở đầu không bị cắt. Không ghi số byte vào file này. Runtime UNVERIFIED.
- **Claude Code:** `CLAUDE.md` ở root và ở từng domain import `AGENTS.md` cạnh nó, gồm `apps/mobile/CLAUDE.md`. Runtime UNVERIFIED.
- **T3 Code:** không có file cấu hình riêng trong repo. Không thêm file đó khi chưa có bằng chứng discovery lỗi.
- **Cursor:** không có `.cursor/` hay `.cursorrules`. Không tạo cấu hình Cursor trong PR này.

## Agent skills

`.agents/skills/<id>/SKILL.md` là skill kit. Quy tắc chọn: chỉ skill liên quan tới task — không tất cả, không không skill nào. PR không nhỏ thì ghi skill đã đọc trong body.

Danh sách dưới đây là index. Câu "Minimum consult" là mức file này yêu cầu đọc. PR C mới được sửa trigger. ADR-02 chưa được duyệt, nên bảng tối thiểu trong audit không thay câu này.

**Repo conventions (work-domain entry points):** `web-conventions` (frontend),
`api-conventions` (backend).

**Design/motion craft (`apps/web` UI/UX tasks):** `frontend-design`,
`emil-design-eng`, `apple-design`, `interaction-design`, `adapt`,
`beautiful-shadows`, `reactbits`, `design-review`, `better-interface`.

**Figma design-tool work (any task reading/writing the Luva UI Figma file via
the Plugin API):** `figma-design-verification` — mandatory audit-real-data-
after-every-mutation discipline and known Plugin API gotchas; consult before
any `use_figma` write, not just at the end.

**Quality filters:** `antislop` (core, load first when running the family) +
`antislop-ui`, `antislop-code`, `antislop-layoutmobile`, `antislop-copywriting`,
`antislop-human`.

**Backend & API:** `backend-patterns`, `api-design`, `changing-the-database-schema`.

**Workflow gates (any task):** `branch-and-document`, `git-commit`, `github-pr`,
`autoreview`, `verifying-monorepo-changes`, `diagram-design`.

Minimum consult per task type: any `apps/web` UI/UX change → `web-conventions`
+ `antislop` (core) + relevant craft skills; any backend/schema change →
`api-conventions` + `changing-the-database-schema` when migrations are touched;
any Figma Plugin API task → `figma-design-verification`; every commit/PR →
`git-commit` / `github-pr`.
