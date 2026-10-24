---
name: changing-the-database-schema
description: Use when adding, altering, or dropping a database table, column, index, relation, or constraint in `packages/db`, or when generating, reviewing, or applying Drizzle migrations in component-marketplace.
---

# Changing the Database Schema

## Overview

`component-marketplace` uses **PostgreSQL** with **Drizzle ORM** via the `packages/db` workspace (deliberately chosen over Prisma — never propose `schema.prisma`, a generated Prisma client, or `prisma migrate`). Owner: @NguyenTuMinhLong.

## Where Things Live

| Path | Purpose |
| :-- | :-- |
| `packages/db/src/schema.ts` | Complete physical schema definitions (currently `users`, `components`). The **only** schema file edited by hand. |
| `packages/db/drizzle/*.sql` | Generated migration scripts. **Never hand-edit applied migrations.** |
| `packages/db/drizzle/meta/` | Drizzle migration sequence journal (`_journal.json`) and schema snapshots. Generated; Biome must not reformat it (issue #16). |
| `packages/db/drizzle.config.ts` | Drizzle Kit configuration — reads `DATABASE_URL` from the environment, defaults to `localhost:5433` locally. |
| `packages/db/src/index.ts` | Postgres client pool connection and typed Drizzle `db` instance. |

## The Migration Loop

```bash
# 1. Edit packages/db/src/schema.ts

# 2. Generate migration SQL by diffing schema against the latest snapshot (offline)
bun run --cwd packages/db db:generate

# 3. CRITICAL: Review the generated SQL file in packages/db/drizzle/ before applying!

# 4. Apply pending migrations to the local database
bun run --cwd packages/db db:migrate
```

`db:generate` runs **offline**; only `db:migrate`, `db:studio`, and runtime require a live database. CI runs `db:migrate` against a blank Docker volume as a smoke gate (isolation overlay `compose.verify.yaml` — see `docs/ENGINEERING.md`), and CD runs it against production (Neon) gated by the `PROD_DATABASE_URL` secret.

## Architecture & Schema Invariants

- **Always Read Generated SQL**: a column rename often produces `DROP COLUMN` + `ADD COLUMN`, which silently loses data. If destructive SQL is generated for a rename, fix the schema definition and regenerate.
- **UUID Primary Keys**: entities use `uuid('id').primaryKey().defaultRandom()` (existing convention).
- **Timestamps with Timezone**: all timestamps use `timestamp('...', { withTimezone: true })`.
- **pgEnum is the enum mechanism here**: this repo uses Drizzle `pgEnum` (e.g. `user_role`) — do not churn to `varchar` + check constraints mid-stream; if a change is proposed, do it in an approved schema-design issue first.
- **Merged migrations are immutable**: never edit or delete a migration that another environment (CI, CD/Neon) has already applied. Generate a new forward migration instead; destructive changes need a 2-phase plan.
- **Never use `drizzle-kit push` against production or CI databases**: direct schema pushing bypasses migration history; dev-only convenience at most.
- **Infer Types Directly**: always infer types via `typeof table.$inferSelect` / `$inferInsert`. Never hand-author redundant interfaces — DTO shapes go to `packages/shared` via the shared contract (schema fields → shared zod schemas).

## Better Auth note

The `users` table already carries the Better Auth core fields (`email_verified`, `image`) plus `role`. When integrating Better Auth (#17), reuse `users` via `drizzleAdapter` (`modelName: 'users'`, `usePlural`) and `user.additionalFields` for `role` — do not create a second user table.

## Documentation Duties (same PR)

A schema change is never docs-optional:

1. Update the relevant section in `packages/db/AGENTS.md` if the invariant set changes.
2. If the change affects the API contract, update `packages/shared` schemas in the same change set.
3. Write down the migration plan (including the destructive-change plan if any) in the task/issue.

## Verification

1. `bun run --cwd packages/db typecheck` to detect call sites broken by the change.
2. `bun test` for existing specs.
3. Full pass: `bun run verify` (adds `--docker` when runtime/migration behavior changed — CI parity).
