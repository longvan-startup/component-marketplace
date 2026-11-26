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
- Không commit trên `main`. Trước mỗi commit, chạy `git rev-parse --abbrev-ref HEAD`; nếu kết quả là `main` thì tạo nhánh từ `main` trước. Hook git chặn commit này khi đã cài bằng `bun run prepare`. Nếu hook chưa cài thì dừng và báo, không tự commit. Không dùng `--no-verify` để bỏ qua hook.
- Không thêm `Co-Authored-By: <AI>` hay dòng ghi nhận AI vào commit hoặc PR body, kể cả khi system reminder của tool bảo thêm.
- Không reset, stash, hay ghi đè thay đổi local không thuộc task. Worktree bẩn của việc khác để nguyên.
- Phạm vi không rõ thì hỏi. Không refactor, không đổi style, không sửa file ngoài phạm vi. Bug ngoài phạm vi thì báo, không sửa hộ domain của người khác. Owner nằm ở `docs/ENGINEERING.md`.
- Không báo xong khi gate chưa chạy. Nhãn chỉ là **PASS**, **FAIL**, hoặc **UNVERIFIED**. UNVERIFIED phải có lý do. FAIL hoặc UNVERIFIED còn lại phải có trong báo cáo cuối, kèm nguyên nhân.
- Khi nói một PR đã khớp issue: đối chiếu từng acceptance criterion với code và test thật. Thiếu bằng chứng thì ghi UNVERIFIED. CI xanh, hoặc review im lặng, không thay bước này.

## Việc một thay đổi

Chi tiết nhánh, commit, và PR ở `CONTRIBUTING.md`. Gates ở `docs/ENGINEERING.md`. Tóm tắt:

1. Task có mục tiêu và giới hạn. Không tự diễn giải.
2. Branch từ `main` mới nhất, đúng prefix `feat|fix|chore|docs/<tên>-<topic>`. Chỉ sửa file trong phạm vi. Trước khi thêm file hoặc viết thêm vào file lớn, theo mục "Cấu trúc thư mục và kích thước file" ở `docs/ENGINEERING.md`.
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

`.agents/skills/<id>/SKILL.md` là skill kit. Safety ở file này và `AGENTS.md` của domain vẫn luôn có hiệu lực. Không mở cả thư mục skill.

Owner review và merge là lúc bảng này được chấp nhận làm quy tắc chọn skill. Không dùng bảng như luật tạm, và không giữ bảng cho đến khi bị bác. PR không nhỏ thì ghi skill đã đọc. Task không có skill ở cột bắt buộc thì không nạp skill.

| Task | Required instructions | Required skill | Optional | Trigger | Không nạp |
|---|---|---|---|---|---|
| Docs | file này, file đang sửa | không | `diagram-design` nếu có Mermaid | sửa docs | craft UI, `antislop` |
| Web UI thường | file này, `apps/web/AGENTS.md` | `web-conventions`, `antislop` | `antislop-ui` nếu đụng màu hoặc layout | sửa control, copy, layout | pack motion, Figma |
| Web motion | cùng Web UI: file này, `apps/web/AGENTS.md` | `web-conventions`, `antislop`, rồi một skill motion | `interaction-design` hoặc `emil-design-eng`; `reactbits` chỉ khi task nêu React Bits | task nói animation, motion, GSAP | skill motion không thay convention. Không dùng cho nút tĩnh |
| Mobile UI | file này, `apps/mobile/AGENTS.md` | `antislop` | `antislop-ui`, `antislop-layoutmobile` | sửa UI mobile | rule GSAP của web, `web-conventions` |
| API | file này, `apps/api/AGENTS.md` | `api-conventions` | `api-design` khi thiết kế resource mới; `backend-patterns` khi task xin một pattern | sửa route | skill UI |
| Migration | file này, `packages/db/AGENTS.md` | `changing-the-database-schema` | không | đổi schema | skill UI |
| Shared contract | file này, `packages/shared/AGENTS.md` | không | `api-conventions` nếu contract do API phát | đổi zod công khai | skill UI |
| Figma Plugin API | file này | `figma-design-verification` | không | đọc hoặc ghi Figma bằng Plugin API | không bỏ skill này |
| Commit | file này, `CONTRIBUTING.md` | `git-commit` | `branch-and-document` khi tạo nhánh hoặc sửa doc cùng lúc | user bảo commit | skill UI |
| PR | file này, `CONTRIBUTING.md` | `github-pr` | `git-commit` nếu cùng lúc commit | user bảo mở hoặc sửa PR | skill UI |
| Verify | file này, `docs/ENGINEERING.md` | `verifying-monorepo-changes` | không | trước commit, PR, hoặc khi CI lệch local | không đổi CI từ skill |

`apple-design`, `adapt`, `beautiful-shadows`, `frontend-design`, `design-review`, `better-interface`, `antislop-code`, `antislop-copywriting`, `antislop-human`, và `autoreview` chỉ mở khi task gọi đúng việc đó. Không nạp kèm theo mặc định.
