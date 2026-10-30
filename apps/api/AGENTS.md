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

## Env variables (validated at boot — issue #29)

Validated with zod at startup (`src/env.ts`, `parseApiEnv`). Unknown variables
are ignored (Vercel/compose inject plenty). Invalid values ⇒ `ApiConfigError`
+ exit 1 — message names the variable, NEVER its value.

| Var | Meaning | Invalid/missing behavior |
|---|---|---|
| `PORT` | listen port | default `4000`; non-numeric/out-of-range ⇒ boot fails |
| `NODE_ENV` | `development` / `test` / `production` | default `development`; other values ⇒ boot fails |
| `DATABASE_URL` | postgres connection (postgres.js) | optional; empty/missing ⇒ degraded (`/health` OK, `/health/db` 503); non-postgres scheme ⇒ boot fails |
| `CORS_ORIGINS` | CSV exact-match origin allowlist (dev cross-origin) | optional; prod same-origin `/api/*` (Vercel Services) needs none |
| `BETTER_AUTH_SECRET` | Better Auth signing/encryption secret | required with `DATABASE_URL` in production; at least 32 characters; never log |
| `BETTER_AUTH_URL` | Better Auth public API base URL | required with `DATABASE_URL` in production; absolute `http(s)` URL |

Never log the values of these variables (secrets live inside `DATABASE_URL`).

## Error envelope (issue #29 §B)

Every non-auth error response — 404 fallback, thrown `ApiHttpError`, express
JSON parse failure, unexpected 500 — goes through `sendError()`
(`src/errors.ts`) and is validated against `apiErrorSchema` from `@marketplace/shared`:
`{ code: UPPER_SNAKE, message, status 400–599, details? }`. Stack traces and
db/host details never leave the server.

`/api/auth/*` is owned by Better Auth and keeps its response shape, including
auth errors. Do not wrap or translate those responses in the API; frontend code
maps Better Auth error codes/messages to UI states.

## Quality gates (all required before declaring "done")

- `bun run --cwd apps/api typecheck`
- `bun run lint` (repo-wide Biome)
- `bun test` and `bun run build:api`
- Preserve the `createServer()` test contract; Docker runtime smoke when the
  server behavior changed.
