# packages/db — Database layer rules

You are working in the Database domain of component-marketplace. Repo-wide
rules live in the root `AGENTS.md` (+ scoped `apps/api/AGENTS.md` for the
API/domain contract). Backend owner: @NguyenTuMinhLong.

## Scope

- READ anything. EDIT only `packages/db/**` — schema, migrations, config, and
  this package's tests. CI/GitHub Actions edits that touch migrations need the
  other owner's review (infra = both).
- Migrations are append-only once shipped: never edit or delete an existing
  migration file. Fix forward with a new migration.

## Boundaries (CI-enforced: `bun run boundary`)

- Only this package may own drizzle: `apps/web` must never import it
  (frontend talks to the backend via its public HTTP API).
- Consumers import through the package specifier `@marketplace/db` only —
  never relative paths into `packages/db/src`.
- Do not leak DB models into public API responses directly (DTOs live in
  `@marketplace/shared`).

## Conventions

- `packages/db/drizzle/meta/*` is generated output — regenerate, never
  hand-edit.
- Schema changes: update `src/schema.ts` → `bun run db:generate` → review the
  generated SQL before committing → `bun run db:migrate` locally against the
  compose Postgres (host port 5433, password in `.env`).
- Better Auth account identities are unique by `(provider_id, account_id)`;
  keep the `accounts_provider_account_unique` index. Before applying it to a
  database with existing data, run the count-only preflight query recorded in
  issue #97. Stop if collisions exist; do not clean credentials automatically.
- CI runs on a blank volume and does not apply migrations automatically; the
  `/health/db` check only pings `select 1` (see issue #15).

## Quality gates

- `bun run --cwd packages/db typecheck` and `bun run --cwd packages/db build`
- `bun run lint` (repo-wide Biome)
- `bun test` (including the `/health/db` endpoint tests)
- For migration changes: verify a fresh `docker compose up -d` + manual
  `db:migrate` applies cleanly from a blank volume.
