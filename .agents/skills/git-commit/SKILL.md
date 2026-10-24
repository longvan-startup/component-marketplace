---
name: git-commit
description: Execute git commit with Conventional Commit message analysis, intelligent staging, and message generation for component-marketplace. Use when the user asks to commit changes, create a git commit, or mentions "/commit". Adapted from github/awesome-copilot's git-commit skill to this repo's commitlint/lefthook rules; defer to the `branch-and-document` skill for whether to branch first.
license: MIT
allowed-tools: Bash
---

# Git Commit with Conventional Commits

Adapted from [github/awesome-copilot](https://github.com/github/awesome-copilot/blob/main/skills/git-commit/SKILL.md) (MIT) for `component-marketplace`'s actual enforcement: `commitlint.config.mjs` + `lefthook`. This skill covers composing and executing the commit itself — read `.agents/skills/branch-and-document` first to decide whether the change stays on the current branch or needs a new `<type>/<kebab-case-slug>` branch.

## Overview

Create standardized, semantic git commits using the Conventional Commits specification. Analyze the actual diff to determine the appropriate type, scope, and message — never guess from memory of what you changed.

## Conventional Commit Format

```
<type>(<scope>): <description>

<body — see "Required Commit Body Template" below>

[optional footer(s), e.g. Closes #123, BREAKING CHANGE: ...]
```

- **Header max length**: 100 characters (`@commitlint/config-conventional` default, matches `CONTRIBUTING.md`'s stated limit) — exceeding it fails the `lefthook` commit hook (and the abort is silent: staged work stays staged; re-run the commit with a shorter header).
- **Never hard-wrap the body.** `commitlint.config.mjs` disables `body-max-line-length`/`footer-max-line-length` specifically so a full paragraph never needs to be split across lines — let the terminal/editor soft-wrap it; do not reintroduce manual wrapping.
- **Scope**: optional; when used, name the affected workspace/domain (`shared`, `db`, `api`, `web`, `cd`, `agents`, `auth`, `deps`, …), lowercase, no spaces.
- **Description**: present tense, imperative mood ("add", not "added"/"adds"), no trailing period.
- **No hand-authored `(#N)` PR-number suffix.** GitHub appends `(#<PR>)` to the header automatically when a PR is squash-merged — never fake a PR number in a commit you're authoring locally; it doesn't exist yet.

## Commit Types

`commitlint.config.mjs`'s `type-enum` is the actual enforced list — only these are valid:

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build system/dependencies      |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

## Breaking Changes

```
# Exclamation mark after type/scope
feat(api)!: remove deprecated endpoint

# BREAKING CHANGE footer
feat(cms): allow section config to extend other sections

BREAKING CHANGE: `extends` key behavior changed
```

## Required Commit Body Template

Adapted from [openclaw's commit style](https://github.com/openclaw/openclaw/commit/5b22b552246824ade63c239ec2a34937c5cd1bb6) — mandatory for every `feat`/`fix`/`perf`/`refactor` commit, and for any other type unless it's a single, obviously mechanical change (a dependency bump, a typo fix, a formatter-only pass — see the trivial-commit exception at the end). This is not decoration: a reviewer (human or the `autoreview` skill) reads the body to know what changed and why _without_ re-deriving it from the diff, and to know exactly what was actually verified. Do not skip a section; write "N/A" with a one-clause reason only when a section genuinely does not apply — never leave it out silently.

```
<type>(<scope>): <imperative description>

[Closes #<issue>]

## What Problem This Solves

<The concrete bug or gap, one or two sentences. State what's wrong, not what you did.>

## User Impact

<What changes for whoever consumes this — end user, API caller, or another developer reading/calling the code. Explicitly name what stays the same if that's non-obvious ("X is unchanged"). State config/migration steps, or say plainly that none are needed.>

## Why This Change Was Made

<The approach taken and why — especially why not an obvious alternative. Root-cause framing: name the owning boundary you fixed at, not the symptom you could have special-cased instead.>

## Evidence

<Every claim here must be something you actually ran or observed — never invented or assumed.>
- <Concrete before/after behavior or measurement when one exists (a number, a query plan, a generated SQL/OpenAPI diff) — not "should now work correctly".>
- <Test result with real counts: "12/12 passing", not "tests pass".>
- <The exact command you ran to verify this, e.g. `bun run verify`.>
- <Relevant gate status for the touched scope: format/lint/typecheck/duplication/knip/build.>
```

**Trivial-commit exception**: a single mechanical change (version bump, one-line typo fix, formatter-only pass) may use a one-line body instead of the full template, but it must still name what was verified — e.g. `Ran oxfmt --check; no other files touched.` — never an empty body.

**Same structure for PR bodies.** `.github/PULL_REQUEST_TEMPLATE.md` mirrors this template in Vietnamese (Vấn đề này giải quyết gì / Ai bị ảnh hưởng / Tại sao đổi như vậy / Bằng chứng gates) — fill both the same way; don't write a thin PR description and expect the commit body to carry the detail, or vice versa.

## Workflow

### 1. Analyze the diff

```bash
git status --porcelain
git diff --staged   # if files are already staged
git diff             # if nothing is staged yet
```

Base the type/scope/description on what the diff actually shows, not on the request that prompted the change.

### 2. Stage files

Group logically related changes into one commit; keep unrelated changes (e.g. an incidental fix plus the requested feature) as separate commits.

```bash
git add path/to/file1 path/to/file2
git add src/content/**        # by pattern
git add -p                    # interactive, for splitting a file's changes
```

**Never commit secrets** (`.env`, credentials, private keys — `.env.example` only, never `.env`).

### 3. Generate the commit message

- **Type**: what kind of change is this (see table above)?
- **Scope**: what app/domain is affected?
- **Description**: one-line summary, imperative mood, ≤100 characters total header.
- **Body**: fill in the "Required Commit Body Template" above — What Problem This Solves / User Impact / Why This Change Was Made / Evidence. Write the Evidence bullets from commands you actually ran in this session, not from memory of what you intended to run.
- Reference issues right after the header when relevant: `Closes #123`, `Refs #456`.

### 4. Execute the commit

```bash
# A trivial, purely mechanical change may use a one-line body (see the exception above)
git commit -m "chore: bump drizzle-orm to 0.45.3"

# Every other commit: full body via a message file — avoids shell quoting/backtick issues
# with the diff/code snippets that naturally end up in Evidence bullets.
cat > /tmp/commit-msg.txt <<'EOF'
fix(api): draft — replace with the real change before committing

Closes #123

## What Problem This Solves

<The concrete bug or gap, one or two sentences.>

## User Impact

<What changes for whoever consumes this; name what stays unchanged if non-obvious. State config/migration steps, or say plainly that none are needed.>

## Why This Change Was Made

<The approach taken and why — especially why not an obvious alternative. Root-cause framing, not symptom patching.>

## Evidence

- <Concrete before/after behavior or measurement, not "should now work correctly".>
- <Test result with real counts: "11/11 passing", not "tests pass".>
- Command run: bun test (1.14s wall).
- bun run lint, bun run typecheck, bun run verify: all clean.
EOF
git commit -F /tmp/commit-msg.txt && rm -f /tmp/commit-msg.txt
```

If `lefthook`/`commitlint` rejects the message, fix the message and retry — never bypass with `--no-verify`.

## Git Safety Protocol

- NEVER update git config.
- NEVER run destructive commands (`--force`, `git reset --hard`, `git push --force`) without an explicit user request.
- NEVER skip hooks (`--no-verify`) unless the user explicitly asks.
- NEVER force-push to `main`, `prod`, `staging`, `testing`, or `develop`.
- If a commit fails a hook, fix the underlying issue and create a **new** commit — do not `--amend` a commit that hasn't been shown to the user yet unless asked.
- Never switch to `main` (or another base branch) to commit unless the user asks — stay on the branch already in progress, per `branch-and-document`.
