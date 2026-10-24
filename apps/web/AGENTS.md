# apps/web — Frontend agent rules

You are working in the Frontend domain of component-marketplace. Repo-wide rules
live in the root `AGENTS.md` (+ `docs/ENGINEERING.md`, `CONTRIBUTING.md`); this
file adds Frontend-specific scope only. Frontend owner: @DaoDungVan.

## Scope

- READ anything in the repo. EDIT only `apps/web/**`.
- Do NOT edit `apps/api/**`, `packages/db/**`, or `packages/shared/**` to make
  your feature pass. Found a bug outside this domain? Report it in the task/PR —
  the code owner fixes it.
- Root configs (`package.json`, `bun.lock`, CI, compose): coordinate in the task
  before touching them; never edit silently.

## Boundaries (CI-enforced: `bun run boundary`)

- Never import `@marketplace/db`, `apps/api`, or backend source files. The web
  app talks to the backend ONLY through its public HTTP API
  (`NEXT_PUBLIC_API_URL`).
- Allowed internal dependency: `@marketplace/shared` (types, validation, DTOs)
  — import by package specifier, never by a relative path into `packages/`.
- Do not hand-roll request/response types that already exist in
  `@marketplace/shared`; if they are missing, ask for them there instead of
  creating a second conflicting version.

## Contracts & mocks

- Before integrating an API, the contract (types + validation) is agreed in
  `packages/shared` first. While the backend is not ready, use mock fixtures
  (e.g. `apps/web/mocks/`) that stay aligned with that contract.

## Quality gates (all required before declaring "done")

- `bun run --cwd apps/web typecheck`
- `bun run lint` (repo-wide Biome)
- `bun test` and `bun run build:web`
- Docker runtime smoke (`docker compose up -d --build`) when runtime/UI
  behavior changed.

## Project structure & data architecture (added 2026-10-24)

Feature-based layout (keep it this flat; no extra layers without a task):

| Path | Holds |
|---|---|
| `app/` | routes, layouts, pages (Server Components by default) |
| `app/globals.css` | design tokens in the Tailwind v4 `@theme` block (single light theme) |
| `components/ui/` | tiny presentational primitives (badge, card) |
| `components/layout/` | shared site shell (header/footer) |
| `components/catalog/` | catalog presentation pieces, incl. the only `'use client'` islands (search, preview) |
| `features/<name>/` | feature data layer — `<name>-source.ts` = the ONLY data access point of a feature |
| `lib/api-client.ts` | typed HTTP client + per-runtime base URL (`API_URL_INTERNAL` binding on the server, `NEXT_PUBLIC_API_URL` in the browser, same-origin `/api` default per root `vercel.json` rewrites) |
| `mocks/` | fixtures mirroring the proposed shared contract |

Data rule: pages fetch ONLY through `getCatalogSource()` /
`features/catalog/catalog-source.ts` — hydrating from `mocks/` directly, or
calling `lib/api-client` from components, is a review blocker. Data-source
mode = env `API_MODE` (`mock` default | `live`), so swapping to the HTTP
adapter is config, not a rewrite. The catalog DTO shapes mirror the contract
proposal awaiting Long's review in `packages/shared` — the moment it lands,
imports move there and the local copies are deleted.

Dependency policy: Tailwind v4 is the styling system; do not add state
stores, animation stacks (GSAP/framer-motion), UX/UI kits (shadcn/ui), or
Storybook without a task that proves the use case.
