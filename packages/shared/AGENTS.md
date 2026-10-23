# packages/shared — Shared contract rules

This package is the shared API contract of Frontend and Backend. Repo-wide
rules live in the root `AGENTS.md`. Both domains depend on it, so every change
here requires the opposite domain's review.

## Scope

- Zero internal dependencies: no imports from `apps/*` or `packages/db` —
  CI-enforced (`bun run boundary`). External runtime deps should stay minimal;
  agree before adding any.
- Keep request/response types and validation schemas HERE so both sides cannot
  drift into two conflicting versions. Apps never re-declare them.

## Exports are public API

- Additive changes only by default.
- Breaking changes require agreement from BOTH owners, a deprecation note, and
  a compatibility story for in-flight consumers.

## Quality gates

- `bun run --cwd packages/shared typecheck`
- `bun run --cwd packages/shared build` and `bun test`
- `bun run lint`
