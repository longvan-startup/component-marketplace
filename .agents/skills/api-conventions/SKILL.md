---
name: api-conventions
description: component-marketplace specific conventions for coding `apps/api` and `packages/db` — boundaries, Drizzle-only data access, error envelope, migration immutability, and the verify pipeline. Load before any backend work.
---

Before writing backend code, apply these repo-owned conventions. They complement
(never override) `apps/api/AGENTS.md`, `packages/db/AGENTS.md`, and the root
`AGENTS.md`.

## 1. Boundaries are CI-enforced

- `apps/api/**` may import only its own code plus `@marketplace/db` and
  `@marketplace/shared` (by package specifier — never a relative path into
  `packages/**`).
- `packages/db/**` must stay free of app/framework concerns (no Express, no
  secrets besides reading `DATABASE_URL`); it is imported by both backend code
  and CI/CD migration steps.
- `packages/shared/**` is owned opposite-side: api side proposes contract
  changes, web side reviews them (`packages/shared/AGENTS.md`).

## 2. Data access is Drizzle-only

- Every query goes through the typed Drizzle instance from `packages/db`; no
  raw `postgres` client usage, no raw SQL strings in app code.
- Inferring row types (`table.$inferSelect` / `$inferInsert`) is the only
  row-typing mechanism; DTO shapes used by HTTP go to `packages/shared` (zod
  schemas + `z.infer`) and are derived at one place only.
- Schema changes follow the `changing-the-database-schema` skill: generate →
  read the generated SQL → migrate; merged migrations are immutable,
  `db:push` never touches production or CI databases.

## 3. HTTP surface conventions

- One documented JSON error envelope for every failure path (code + message +
  status) — defined in `packages/shared` and returned by the central error
  middleware (api bootstrap issue #29). No ad-hoc error shapes per route.
- Validation at the edge: request inputs are parsed by the shared schemas
  before any business logic runs; DB constraints are the second line, not the
  first.
- Auth: Better Auth (#17) owns sessions/users via `drizzleAdapter` reusing the
  `users` table — never hand-roll session middleware or a parallel user table
  (`api-conventions` asks you to check #17's decisions before auth-adjacent
  code).
- Logging is one line per request, no secrets, no bodies; `/health*` ends are
  excluded.

## 4. Quality gates (Definition of Done)

```sh
bun run --cwd apps/api typecheck
bun run --cwd packages/db typecheck
bun test          # workspace tests (unit first, colocated *.test.ts)
bun run verify    # full pipeline; add --docker when migrations/compose changed
```

CI parity has no extra gates — required check names
(`Lint / Typecheck / Test / Build`, `Docker build & runtime smoke`) are part of
branch protection and must not be renamed.

## 5. Scope discipline

Edit only `apps/api/**`/`packages/db/**` unless the task grants more. Frontend
facing issues (CORS origins, DTOs) are fixed at the owning boundary, not
patched per-consumer from the web side. Verify that every claim in the final
report is grounded in a command you actually ran (see root AGENTS.md —
PASS / FAIL / UNVERIFIED only).
