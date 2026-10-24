# Autoreview Checklist — component-marketplace

Concrete, evidence-based findings patterns for `apps/api`, `apps/web`. Each item below has actually occurred in this codebase — cite the exact file/line when reporting a match, don't pattern-match by title alone. This is the detail behind [SKILL.md](SKILL.md)'s "What to look for."

## 1. Auth & security

- **Auth/session surface completeness**: Better Auth (#17) is the single owner of sessions/users — no parallel session middleware, no hand-rolled token verification; CORS origins come from validated env config, not ad hoc middleware.
- **CORS wildcard + credentials**: `cors`'s `origin` option cannot be a literal `'*'` string when `credentials: true` is set — browsers require the actual request `Origin` echoed back. Any `enableCors`/`cors()` call combining a wildcard origin list with credentials must reflect the origin (`origin: true` or a callback), never pass the literal `'*'` string through untouched.
- **OpenAPI security scope**: `DocumentBuilder.addSecurityRequirements(...)` sets _document-root_ `security`, which every operation without its own explicit `security` (i.e. no `@ApiBearerAuth`) inherits per the OpenAPI spec. A public route (no `@ApiBearerAuth` decorator) must show `security: undefined` in the generated `openapi.json`/`docs`, not inherit auth from the root. Re-run `bun run src/openapi.ts` (or `bun run openapi:check`) after touching `src/swagger.ts` or any controller's auth decorators — an unflagged regression here makes public endpoints look gated (or vice versa) to client generators and auditors.
- **Secrets exposure**: no real `.env` staged; `.env.example` only ever carries placeholder values; no API keys/tokens/private keys appear in a diff, log statement, or client bundle (`apps/web`).

## 2. Content/CMS draft-vs-published boundary

- **Public read draft leaks**: any query serving `apps/web` or an unauthenticated caller must read from `content_revisions`/`page_revisions.snapshot` via an `INNER JOIN` on `published_revision_id` — never live `content_translations`/`page_translations` columns directly. `status` on the translation row is an editorial-workflow indicator only; it must never gate public visibility on its own.
- **Items/count query parity**: a paginated `list*` method computes `items` and `total` with two separate queries (one `.limit()/.offset()`'d, one `count(*)`). Both **must** carry identical `.where()` conditions and identical joins — a count query missing a join the items query has (e.g. the `content_revisions`/`page_revisions` publish join) silently counts rows the items query would never return, producing a wrong `total`/`totalPages`. Diff the two query builders line by line whenever either changes.
- **DTO filter wiring**: every field on a `*ListQueryDto` (e.g. `categoryId`, `category`, `status`, `type`) must actually be consumed by the repository's `conditions` array. A filter declared in the DTO/Swagger contract but silently ignored by the query returns 200 with unfiltered data — a correctness bug, not a missing feature. Grep the DTO's field names against the repository method to confirm each one appears in a `.where()`/`conditions` clause.

## 3. Concurrency & data integrity

- **Select-then-insert races**: a `findOrCreate`/JIT-provisioning pattern that does a `SELECT` then, only if not found, an `INSERT`, races under concurrent first requests for the same key — the loser hits the unique constraint and throws instead of resolving to the same row. Use a single atomic `INSERT ... ON CONFLICT (<unique column>) DO UPDATE` instead (see `users.repository.ts`).
- **Optimistic locking**: any mutation on `contents`/`pages` (or another `lock_version`-bearing table) must compare-and-swap `lock_version` inside the same transaction as the actual write, per the existing `bumpContentLock`/`bumpLock` pattern — never a bare `UPDATE` that ignores the caller's `expectedLockVersion`.

## 4. Test & file placement discipline

- Tests live only under `apps/api/test/`, mirroring `src/`. Any `*.spec.ts`/`*.test.ts` inside `apps/api/src/` is an immediate P0.
- A new/changed exported function, DTO, or query behavior needs a test that would fail pre-fix and pass post-fix — not a test restating the implementation (mock echoes, field-copy assertions, tautologies).

## 5. Comment & JSDoc discipline

- Exported functions/classes/interfaces/types/controllers/services use standard `/** ... */` JSDoc with `@param`/`@returns`/`@throws` where applicable.
- Flag divider/separator comment lines, comments narrating _what_ the code does (`// call the api`, `// loop over items`), and conversational/AI-monologue comments. In-block comments are for _why_ only (domain rules, protocol/hardware constraints, security invariants).

## 6. Documentation & diagram sync

- A code change updates the matching file under `docs/` on the same branch; a capability with no doc gets a new one, linked from `docs/README.md`.
- A touched `.mmd`/inline mermaid block stays consistent with the code/documents it describes (no render pipeline exists here).
- Markdown prose does not carry manual hard-wrapping of paragraphs.
- A schema change, a shared-contract change, or new agent conventions update the matching docs in the same PR (see the `branch-and-document` skill; routine fixes/refactors don't need this).

## 7. Database migrations

- Generated Drizzle migrations under `apps/api/drizzle/` reflect the intended schema change — a column rename must not appear as a `DROP COLUMN` + `ADD COLUMN` pair that silently loses data; verify against `drizzle-kit generate`'s own diff, not just the SQL file's shape.
- A new/changed unique constraint or index that a repository's `onConflictDoUpdate`/upsert logic depends on actually exists in the migration — the query and the schema must agree.

## 8. Repo/product boundaries

- `packages/db` never hosts data that belongs to a different product boundary; cross-product data lives in its own database/repo.
- No speculative build-ahead: don't add endpoints/components/schemas for a domain doc 03 §21 lists but hasn't been given a full field-level contract for (see root `AGENTS.md` "Do not build ahead of the wiring order").

## 9. CI / quality-gate completeness

- Every package script meant to gate merges (`typecheck`, `test`, `test:e2e`, `openapi:check`, `lint`, `build`) is actually invoked from `.github/workflows/ci.yml` — a task that exists but isn't wired into CI gives a false sense of coverage. Check `package.json` scripts against `ci.yml`'s step list when either changes.
