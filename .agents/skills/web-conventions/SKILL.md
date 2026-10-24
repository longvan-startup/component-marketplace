---
name: web-conventions
description: component-marketplace specific conventions for coding `apps/web` — boundaries, contract-first shared types, mock mode, quality gates, and Next.js 16 caveats. Load before any `apps/web` feature work.
---

Before writing any code in `apps/web`, apply these repo-owned conventions. They
complement (never override) `apps/web/AGENTS.md` and the root `AGENTS.md`.

## 1. Read the Next.js version caveat first

This repo pins Next.js `^16.4.2` — APIs and conventions may differ from your
training data. Before new routing/data patterns, read the relevant guide in
`apps/web/node_modules/next/dist/docs/` (or consult the same docs shipped with
the exact version in `bun.lock`). Heed deprecation notices; do not import
patterns from older Next versions from memory.

## 2. Boundaries are CI-enforced, not style suggestions

- `apps/web/**` must never import `@marketplace/db`, `apps/api`, or any backend
  source file. HTTP over `NEXT_PUBLIC_API_URL` is the only backend channel.
- Import `@marketplace/shared` by package specifier for DTOs/validation —
  never by a relative path into `packages/**`.
- `bun run boundary` (inside `bun run verify`) is the gate; a failing check is
  a design error, not a lint nuisance.

## 3. Contract-first, mock-second, integrate-third

1. The endpoint contract is agreed in `packages/shared` (see the shared
   contract issue in the epic #28 board) — request/response/error shapes live
   there once and only once.
2. While the backend is not ready, render from mock fixtures under
   `apps/web/mocks/` that validate against the same shared schemas. Do not
   fork types locally.
3. Switch to live mode with one env flag (`API_MODE=mock|live` per issue #32);
   default reads from `NEXT_PUBLIC_API_URL`.

## 4. Component craft standards (apply the right design skills)

Rendering defaults: use Server Components for static reads; add
`"use client"` only where a skill-driven interaction needs it. This is an
animation marketplace — motion is product content, so animation-flavored
skills (`emil-design-eng`, `interaction-design`, `reactbits`) are relevant on
most UI work. User-facing copy in the UI is Vietnamese-first while everything
committed elsewhere stays English (root rule).

## 5. Quality gates (Definition of Done)

Run from the repo root before declaring done:

```sh
bun run --cwd apps/web typecheck
bun run lint          # repo-wide Biome
bun test              # workspace tests
bun run build:web
bun run verify        # full local pipeline; add --docker only if compose/runtime changed
```

Never debug via host ports on WSL2 (mirrored networking hides container
reality) — probe inside the container (`docker compose exec`) when a runtime
issue appears.

## 6. Scope discipline

Edit only `apps/web/**` unless the task explicitly grants more. Cross-domain
needs go to the code owner (ownership map in `docs/ENGINEERING.md`); a bug
outside this domain is reported, never silently patched.
