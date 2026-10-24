---
name: verifying-monorepo-changes
description: Run verification checks before committing, opening a PR, or finishing a task in component-marketplace, or when CI fails on a check that passed locally.
---

# Verifying Monorepo Changes

## Overview

`apps/web`, `apps/api`, `packages/db`, and `packages/shared` share one Bun workspace and toolchain. A change in the database schema, shared configuration, or the `packages/shared` contract can break another workspace. Run the full verification pass, not just the directory you edited.

## The Full Verification Pass

Run before finishing any task, opening a PR, or creating a commit:

```bash
bun run verify            # host gates: lint + boundary + typecheck + test + build
bun run verify --docker   # + isolated Docker runtime smoke (compose migration + health)
```

`verify` is the single entrypoint defined in `scripts/verify.sh` (details in `docs/ENGINEERING.md`). Never skip it by running pieces; pieces exist only for the inner loop below. No `--no-verify` shortcuts on hooks either (`lefthook` + `commitlint`, silent-abort semantics — see the `git-commit` skill).

## What the gates are, exactly

- `bun run lint` — Biome 2.5.15, pinned exact. **Do not bump Biome inside an unrelated PR** (the 2.6.x formatter is stricter and breaks lint).
- `bun run boundary` — cross-domain import checker (`scripts/check-boundaries.mjs`). web must not import `@marketplace/db` or `apps/api`; apps may import only from `packages/**`.
- `bun run typecheck` — sequentially across `packages/shared`, `packages/db`, `apps/api`, `apps/web` (different TS majors may still exist — see the version-unification issue).
- `bun test` — workspace tests.
- `bun run build` — `build:shared` → `build:db` → `build:api` → `build:web`.
- Docker smoke — runs in an isolated compose project (`cmp-verify-*`), sprites no dev data, cleans up by its own trap; never debug it through host ports (WSL2 mirrored networking) — probe inside the container.
- CI additionally runs the same gates plus the docker smoke with job name `Docker build & runtime smoke` — **required check names must not be renamed**.

## Scoping While Iterating

```bash
bun run --cwd apps/web typecheck    # web only
bun run --cwd apps/api typecheck    # api only
bun run --cwd packages/db typecheck # schema/migrations only
bun test path/to/some.test.ts       # a single spec
bun run build:web                   # one workspace build
```

Always run the full `bun run verify` before creating a commit/PR. If CI fails on a check that passed locally, compare tool versions (runner vs local) before assuming flakiness — and check whether `next build` rewrote `apps/web/tsconfig.json` (it does; revert before committing).
