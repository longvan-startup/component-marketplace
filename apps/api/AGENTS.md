# apps/api — Backend agent rules

You are working in the Backend domain of component-marketplace. Repo-wide rules
live in the root `AGENTS.md` (+ `docs/ENGINEERING.md`, `CONTRIBUTING.md`); this
file adds Backend-specific scope only. Backend owner: @NguyenTuMinhLong.

## Scope

- READ anything in the repo. EDIT `apps/api/**` (+ `packages/db/**` after the
  Database PR is merged onto main).
- Do NOT edit `apps/web/**` or `packages/shared/**` to make your feature pass.
  Found a bug outside this domain? Report it in the task/PR — the code owner
  fixes it.
- Root configs (`package.json`, `bun.lock`, CI, compose): coordinate in the task
  before touching them; never edit silently.

## Boundaries (CI-enforced: `bun run boundary`)

- Never import from `apps/web` — direct or relative.
- Allowed internal dependencies: `@marketplace/shared`, `@marketplace/db`.
- Do not leak internal DB models as public API responses. Public DTOs and
  validation schemas belong in `@marketplace/shared`.

## API contracts

- `createServer()` and the existing `/health` contract must not break.
- Breaking contract changes: make them additive first, notify the frontend
  owner in the PR, and add compatibility tests.

## Quality gates (all required before declaring "done")

- `bun run --cwd apps/api typecheck`
- `bun run lint` (repo-wide Biome)
- `bun test` and `bun run build:api`
- Preserve the `createServer()` test contract; Docker runtime smoke when the
  server behavior changed.
