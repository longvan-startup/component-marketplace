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
| `RESEND_API_KEY` | Resend API credential for verification/reset email | optional; set or omit together with `AUTH_EMAIL_FROM`; never log |
| `AUTH_EMAIL_FROM` | Verified sender email address used by Resend | optional; set or omit together with `RESEND_API_KEY` |
| `GOOGLE_CLIENT_ID` | Google OAuth client id | optional; set or omit together with `GOOGLE_CLIENT_SECRET`; never log the secret |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | optional; pair with `GOOGLE_CLIENT_ID` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client id | optional; set or omit together with `GITHUB_CLIENT_SECRET`; never log the secret |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | optional; pair with `GITHUB_CLIENT_ID` |

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

## Email layout

Every email uses the same layout as the auth emails. A new email reuses it
(`src/auth/email-template.ts` for layout, `email-copy.ts` for wording,
`email-images.ts` for artwork); do not design a second one.

Blocks, in order, on a white page at most 700px wide:

1. Logo wordmark in solid colours, as the web `Logo` component draws it.
2. Centred 466px column: 44px two-line heading, 16px light paragraph, violet
   pill button, a small note, 466px hero picture.
3. 20px section title and a two-column list with dark top rules (one column on
   phones).
4. Grey rounded thank-you block: two round team photos and the solid wordmark.
5. Grey footer with rounded top: legal lines and the large faded brand name,
   the only place with a gradient.

Rules: tables with inline styles; pictures are inline attachments referenced by
`cid:`; hex colours are allowed here because mail clients ignore CSS variables;
escape every user value; no links to pages that do not exist, no invented postal
address, no photos or marks that are not ours.

## Quality gates (all required before declaring "done")

- `bun run --cwd apps/api typecheck`
- `bun run lint` (repo-wide Biome)
- `bun test` and `bun run build:api`
- Preserve the `createServer()` test contract; Docker runtime smoke when the
  server behavior changed.
