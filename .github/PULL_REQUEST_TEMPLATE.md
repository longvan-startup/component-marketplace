<!--
Cấu trúc khớp với commit body chuẩn — mọi section phải có bằng chứng thật (lệnh đã chạy, output), không claim suông.
Ghi "N/A" + một mệnh đề lý do nếu section không áp dụng.

Quy trình đầy đủ: AGENTS.md — Task → Implement → Verify → PR.
Chi tiết chuẩn: docs/ENGINEERING.md; Branch/commit: CONTRIBUTING.md.
-->

## Loại thay đổi (Conventional Commits)

Chọn một loại chính cho PR này:

- [ ] `feat` — feature mới
- [ ] `fix` — fix bug
- [ ] `chore` — cấu hình, tooling, dependency
- [ ] `docs` — tài liệu
- [ ] `refactor` — refactor không đổi hành vi
- [ ] `test` — thêm/sửa test
- [ ] `ci` — CI/CD, Docker

## Vấn đề này giải quyết gì

<!-- Bug/gap cụ thể, 1-2 câu. Cái gì sai, không phải "làm gì". `Closes #<issue>` nếu có. -->

## Ai bị ảnh hưởng

<!-- end user / API caller / dev khác thấy gì mới, giữ nguyên gì; các bước config/migration nếu có, hoặc ghi rõ "không cần". -->

## Vì sao cách này (chứ không phải hướng khác hiển nhiên)

<!-- Cách tiếp cận + lý do. -->

## Bằng chứng (Evidence)

<!-- Mọi claim phải là thứ bạn CHẠY hoặc QUÁN SÁT thực sự: trước/sau cụ thể, số test, lệnh đã chạy (bun run verify / --docker), trạng thái gates cho đúng scope. -->

## Checklist

- [ ] `bun run verify` PASS (lint + typecheck + test + build)
- [ ] `bun run verify --docker` nếu đụng Docker/compose/infra
- [ ] Chỉ sửa đúng phạm vi được giao (không file "nhân tiện")
- [ ] Docs liên quan cập nhật cùng PR nếu hành vi/setup đổi
- [ ] Không commit secrets / `.env`
- [ ] Nhánh không phải `main` (feature branch → PR vào `main`)
