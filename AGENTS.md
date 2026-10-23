# AGENTS.md — Quy tắc cho AI Agent (OpenCode, Codex, T3 Code)

Người đọc đầu tiên của file này là **agent**, không phải con người.
Toàn bộ chuẩn kỹ thuật nằm tập trung ở 2 chỗ duy nhất — **không lặp lại nội dung ở đây:**

- [`docs/ENGINEERING.md`](docs/ENGINEERING.md) — coding standards, ownership, Definition of Done, quality gates
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch strategy, Conventional Commits, PR review process

## Bắt buộc trước khi sửa bất kỳ dòng code nào

1. Đọc `docs/ENGINEERING.md` và `CONTRIBUTING.md` trước tiên.
2. Xác định **phạm vi task** và **giới hạn thay đổi** của mình; phạm vi không rõ thì hỏi, không đoán.
3. Chỉ sửa đúng module được giao. Không refactor, không đổi style, không sửa file "nhân tiện" ở module khác.

## Quy trình chuẩn một thay đổi (Task → Implement → Verify → PR)

1. **Task**: mục tiêu + phạm vi + giới hạn phải rõ ràng trong task/issue (nên tạo qua issue template "Task" của repo). Task không rõ ràng → hỏi, không tự diễn giải.
2. **Implement**: branch từ `main` mới nhất (`feat|fix|chore|docs/<tên>-<topic>`), chỉ đụng đúng phạm vi được giao — xem `CONTRIBUTING.md`.
3. **Verify**: chạy `bun run verify` (toàn bộ quality gates một lệnh — xem `docs/ENGINEERING.md`; thêm `--docker` nếu đụng Docker/compose). Không PASS đủ thì không báo "xong".
4. **PR**: tiêu đề Conventional Commits, dùng PR template, ghi bằng chứng gates vào PR body; chờ CI xanh trên commit cuối + review code owner — xem `CONTRIBUTING.md`.

## Trong khi làm việc

- Không tự merge PR, không deploy, không push vào `main` trực tiếp.
- **Không bao giờ** đưa secrets, token, API key vào logs, commit, PR body. `.env` local chỉ để chạy thử, không commit.
- Khi phát hiện vấn đề nằm ngoài phạm vi (bug, thiếu config, CI sai): **báo lại, không tự sửa** nếu thuộc domain của người khác — xem ownership map trong `docs/ENGINEERING.md`.

## Báo cáo hoàn thành

- Chạy đủ **quality gates** (xem `docs/ENGINEERING.md`) trước khi tuyên bố "xong".
- Kết quả mỗi gate chỉ được báo theo một trong ba nhãn: **PASS** / **FAIL** / **UNVERIFIED**. "UNVERIFIED" phải có lý do (ví dụ: thiếu tool trên máy).
- Có FAIL hoặc UNVERIFIED còn tồn đọng thì phải nêu trong báo cáo cuối, kèm nguyên nhân và gợi ý xử lý — không được im lặng về trạng thái chưa chắc chắn.

## Scoped instructions & boundary enforcement

Workspaces carry their own agent instructions — read the file for the directory
you are working in, in addition to this one:

- `apps/web/AGENTS.md` — Frontend (owner: @DaoDungVan)
- `apps/api/AGENTS.md` — Backend (owner: @NguyenTuMinhLong)
- `packages/shared/AGENTS.md` — shared API contract (opposite-owner review)
- `packages/db/AGENTS.md` — add only after the Database PR merges onto main.

Tool discovery (verified 2026-10-22 against current tool docs):

- OpenCode: loads the root `AGENTS.md`; scoped files load via the
  `instructions` globs in `opencode.json` (nested `AGENTS.md` is NOT
  auto-discovered by default).
- Codex: concatenates `AGENTS.md` from the repo root down to the working
  directory (32 KiB total cap — keep scoped files small).
- Claude Code: reads the `CLAUDE.md` shim in each domain directory, which
  imports the scoped `AGENTS.md`.
- T3 Code: follow the agents.md convention; verify its discovery behavior with
  the tool owner before relying on it.

Cross-domain imports are CI-enforced: `bun run boundary`. A PR touching both
`apps/web/**` and backend code (`apps/api/**`, `packages/db/**`) must carry the
`cross-domain` label (see the owner-scope workflow).
