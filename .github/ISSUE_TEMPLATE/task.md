---
name: Task
about: Một thay đổi có phạm vi rõ ràng (Task → Implement → Verify → PR)
title: '[task] '
labels: task
assignees: []
---

<!-- Quy trình: AGENTS.md — "Task → Implement → Verify → PR".
     Chi tiết chuẩn kỹ thuật: docs/ENGINEERING.md; branch/commit/PR: CONTRIBUTING.md -->

## Mục tiêu

<!-- Sửa gì, vì sao? Module/file nào? Owner nào? -->

## Phạm vi & Giới hạn

- **In scope**:
- **Out of scope** (tường minh, không làm):

## Verify — Definition of Done

- [ ] `bun run verify` PASS (lint + typecheck + test + build)
- [ ] `bun run verify --docker` nếu đụng Docker/compose/infra
- [ ] Chỉ đụng đúng In-scope, không file "nhân tiện"
- [ ] CI xanh trên commit cuối của PR
- [ ] PR title Conventional Commits + body có bằng chứng gates
