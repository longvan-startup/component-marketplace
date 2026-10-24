---
name: branch-and-document
description: Follow branching, commit messaging, and continuous documentation workflows before creating code changes or pull requests in component-marketplace.
---

# Branch and Document

## Overview

Workflow gate for any non-trivial change: decide branch naming, messaging, and documentation duties **before** writing code, so the PR lands green with no forgotten docs.

## Branching

- Branch from the latest `main` (`git fetch origin && git switch -c <type>/<kebab-case-slug> origin/main`), where `<type>` matches `commitlint.config.mjs`'s `type-enum` (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`, `ci`, `build`, `revert`).
- Task scope comes from the GitHub issue (`task.md` template) — issue first for M/L-size work; XS/S tweaks may commit directly.
- One feature branch per task; delete merged branches locally and on remote. Never commit directly to `main`; never force-push.
- A PR touching both `apps/web/**` and backend (`apps/api/**`, `packages/db/**`) must carry the `cross-domain` label and follow the ownership map in `docs/ENGINEERING.md` (report, don't patch, outside your domain — unless the task grants the scope).

## Commit & PR formatting

Follow the `git-commit` skill (Conventional Commits, mandatory body template, ≤100-char header) and the `github-pr` skill (labels at creation; PR template mirrors the commit body in Vietnamese). Never bypass hooks with `--no-verify`.

## Continuous Documentation Rule

A code change updates the matching doc **on the same branch**:

| Changed area | Doc duty |
|---|---|
| Repo conventions/gates | `docs/ENGINEERING.md` (gates table, isolation rules) |
| Agent instructions | relevant `AGENTS.md` (root) or scoped `apps/*/AGENTS.md`, `packages/*/AGENTS.md` |
| Deploy/CD behavior | `docs/DEPLOYMENT.md` (verified-state table must be re-verified by real commands) |
| Schema | see the `changing-the-database-schema` skill (invariants + shared schemas) |
| New workspace convention | scoped `AGENTS.md` of that workspace, plus the root skill index if a new skill is born |

If a documented fact (state table in `DEPLOYMENT.md`, versions, job names) becomes stale because of your change, update it — a PR that leaves its own docs wrong is a FAIL, not a nice-to-have.
