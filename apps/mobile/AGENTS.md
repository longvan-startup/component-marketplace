# apps/mobile — Expo client rules

Repo-wide rules live in the root `AGENTS.md`. This file is the mobile domain
only. Owner: @DaoDungVan. Changes to `scripts/`, workflows, or
`@marketplace/shared` still need both owners.

## Scope

- EDIT only `apps/mobile/**` unless the task names another path.
- This app is an HTTP client. Import `@marketplace/shared` and nothing else
  from the monorepo. Do not import `apps/web`, `apps/api`, or `packages/db`.
- Do not redeclare catalog or auth payloads. Parse them with the zod schemas
  from `@marketplace/shared`.
- Session tokens go through `src/session-token.ts` (Expo SecureStore). The API
  still authenticates the web with cookies. A bearer token on the API is a
  separate backend task, not a second user table.

## Animation and UI

Reanimated is the animation stack. Do not add GSAP or framer-motion. Web's
GSAP rule stays in `apps/web` and does not apply here.

## Runtime and release

- Expo Go or a dev build. `EXPO_PUBLIC_API_URL` defaults to
  `http://localhost:4000` for that. A store binary must set the production
  API URL.
- Scheme `luva` and bundle id `ui.luva.marketplace` stay stable so a later
  store build can reuse them.
- Do not add EAS, a simulator, or an Android SDK step to `bun run verify`.
  This package's gate is `typecheck` plus unit tests that `bun test` can run.
- Do not add a `deploy/` target. Store submission is a later workflow.

## Quality gates

- `bun run --cwd apps/mobile typecheck`
- `bun test` (tests colocated as `<module>.test.ts`)
- `bun run lint`
