# Pull Request

## Loại thay đổi (Conventional Commits)

Chọn một loại chính cho PR này:

- [ ] `feat` — feature mới
- [ ] `fix` — fix bug
- [ ] `chore` — cấu hình, tooling, dependency
- [ ] `docs` — tài liệu
- [ ] `refactor` — refactor không đổi hành vi
- [ ] `test` — thêm/sửa test
- [ ] `ci` — CI/CD, Docker

## Mô tả

<!-- PR này làm gì? Tại sao? -->

## Cách test

<!-- Cách kiểm chứng thay đổi: lệnh đã chạy, kết quả mong đợi -->

## Checklist

- [ ] Đã chạy `bun run lint`
- [ ] Đã chạy `bun run typecheck`
- [ ] Đã chạy `bun run build`
- [ ] Không commit secrets / `.env`
- [ ] Nhánh không phải `main` (feature branch → PR vào `main`)
