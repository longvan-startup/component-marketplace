# CONTRIBUTING.md

Chuẩn kỹ thuật nằm ở [`docs/ENGINEERING.md`](docs/ENGINEERING.md); quy tắc cho AI agent ở [`AGENTS.md`](AGENTS.md).
File này chỉ chứa **process** (branch, commit, PR, review).

## Windows và line endings

Repo dùng LF cho file text. `.gitattributes` bảo đảm các checkout mới dùng LF kể cả khi Git có `core.autocrlf=true`; `.editorconfig` hướng dẫn editor giữ LF. Hook pre-commit chạy lint trên toàn repo, nên lỗi định dạng ở file khác cũng có thể chặn commit.

Với checkout cũ đã có CRLF, thay đổi `.gitattributes` không tự viết lại mọi file đang có. Trước khi làm mới checkout, kiểm tra `git status --short` và lưu an toàn toàn bộ thay đổi chưa commit. Cách ít rủi ro là tạo clone mới sau khi quy tắc đã vào nhánh cần dùng, rồi chuyển các thay đổi đã lưu sang clone mới. Không dùng lệnh ghi đè hoặc khôi phục hàng loạt trên working tree có thay đổi chưa lưu.

Nếu cần chẩn đoán, chạy `git config --show-origin --get-all core.autocrlf` và `git ls-files --eol <đường-dẫn>` trong cùng môi trường chạy Git; `i/lf` là nội dung trong index và `w/crlf` là file trên ổ đĩa. Sau khi xử lý, chạy `bun run lint` để kiểm tra toàn repo.

## Branch strategy

- `main` là branch duy nhất được bảo vệ. **Không bao giờ commit trực tiếp vào `main`.**
- Mọi thay đổi đi qua feature branch, prefix theo type + người tạo:
  - `feat/long-db-drizzle`, `fix/van-health-db`, `chore/harness-ci-hardening`.
- Nhánh ngắn hạn: 1 chủ đề, sống vài ngày. Loãng ra chủ đề khác thì branch/PR mới.

## Conventional Commits

Commit và tiêu đề PR cùng format: `type(scope): mô tả ngắn`.

| type | dùng khi |
|---|---|
| `feat` | chức năng mới |
| `fix` | sửa bug |
| `chore` | tooling, config, infra nội bộ |
| `docs` | tài liệu |
| `refactor` | đảo code không đổi hành vi |
| `test` | thêm/sửa test |
| `ci` | CI/CD, Docker, workflows |

Một commit chỉ mang một type chính — không mix `feat` + `fix` + `docs` trong cùng commit.

## PR process

1. PR vào `main`, dùng `.github/PULL_REQUEST_TEMPLATE.md`.
2. Tiêu đề PR theo Conventional Commits (cùng format commit).
3. PR chỉ được merge khi: không có conflicts, CI xanh trên commit mới nhất, và (sau khi branch protection bật) ít nhất 1 approval từ code owner — xem `.github/CODEOWNERS`.
4. Merge bằng **squash** để giữ lịch sử linear; quyền merge thuộc chủ repo (`NguyenTuMinhLong`).
5. AGENTS: agent **không tự merge** — xem `AGENTS.md`.

## CI — những gì PR phải vượt

Các check trên `.github/workflows/ci.yml`:

- Lint (Biome)
- Typecheck (shared + api + web)
- Test (bun test — API smoke)
- Build (shared, api, web)
- Docker runtime smoke (compose up + curl health endpoints)

CI đỏ ⇒ không merge, kể cả khi trên máy local mọi thứ xanh — CI mới là source of truth.
