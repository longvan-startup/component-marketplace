---
name: github-pr
description: Create and update pull requests via gh (GitHub CLI) for component-marketplace, including the labels every PR must carry — GitHub never auto-labels a PR, so an agent opening one has to assign labels itself. Use when opening a PR after `.agents/skills/git-commit`, or when editing an existing PR's title/body/labels.
allowed-tools: Bash
---

# GitHub PR Workflow (gh CLI)

Prerequisite: the branch and commits already follow `.agents/skills/branch-and-document` (branching) and `.agents/skills/git-commit` (commit format, including the mandatory body template). This skill covers opening the PR itself and — the part agents otherwise skip — labeling it.

## Create the PR

Write the body to a file first, same reasoning as `git-commit`: avoids shell-quoting issues with the code snippets, backticks, and URLs that belong in Evidence bullets.

```bash
cat > /tmp/pr-body.md <<'EOF'
## Summary

<...>

## Verification

<...>
EOF
gh pr create --base main --head <branch> --title "<type>(<scope>): <description>" --body-file /tmp/pr-body.md --assignee "@me"
rm -f /tmp/pr-body.md
```

`.github/PULL_REQUEST_TEMPLATE.md` mirrors `git-commit`'s Required Commit Body Template (What Problem This Solves / User Impact / Why This Change Was Made / Evidence) plus this repo's own Area/Checklist/Related-issue sections — GitHub pre-fills the textarea from it; fill every section the same way you would a commit body, don't write a thinner PR description than the commits already contain.

## Mandatory labeling

**GitHub does not auto-label a PR.** Every PR an agent opens MUST get labels before or immediately after creation — never leave a PR unlabeled. Source of truth is `gh label list`; the current working set (verified 2026-10-24):

- **Defaults (GitHub + dependabot, don't recreate):** `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`, `dependencies`, `github_actions`, `javascript`.
- **Repo labels:** `task`, `devops`, `ci`, `infra`, `decision`, `governance`, `research`.

Required at minimum — one type label mapped from the dominant Conventional Commit type(s) in the PR:

| Commit type | Label |
| ----------- | ----- |
| `feat` | `enhancement` |
| `fix` | `bug` |
| `docs` | `documentation` |
| `chore`/`refactor`/`test`/`perf`/`style`/`build`/`revert` | `task` (or `devops` when the change is CI/tooling/infra, `ci` when it is a workflow change) |
| `ci` | `ci` (or `github_actions` for pure workflow-file edits) |

Notes:

- `dependencies` is reserved for dependabot PRs — the CI job name and required-check names must not depend on labels.
- A PR touching both `apps/web/**` and backend (`apps/api/**`, `packages/db/**`) must carry the `cross-domain` label per the owner-scope workflow. The label may not exist yet in this repo — if `gh pr edit --add-label cross-domain` reports a label error, create it once with `gh label create cross-domain` and add it.
- No `area:*` / `priority:*` / `size:*` label sets exist in this repo; do not invent them. Areas are communicated through the PR title scope and the affected-paths table below instead:

| Changed path(s) | Scope hint in title |
| --------------- | ------------------- |
| `apps/web/**` | `web` |
| `apps/api/**` | `api` |
| `packages/db/**` | `db` (or `auth` for Better Auth work) |
| `packages/shared/**` | `shared` |
| `.github/**`, `scripts/**`, `deploy/**`, compose | `cd` / `ci` |
| `.agents/**`, `AGENTS.md`, `docs/**` | `agents` / `docs` |

Prefer setting labels at creation time:

```bash
gh pr create --base main --head <branch> --title "..." --body-file /tmp/pr-body.md \
  --label bug --label task
```

If `gh pr edit` ever fails with the Projects-classic GraphQL error, fall back to the REST API (unaffected):

```bash
gh api "repos/<owner>/<repo>/issues/<n>/labels" -X POST \
  -f "labels[]=bug" -f "labels[]=task"
```

## Assignee Policy

**Never assign randomly or hardcode assignees.** A PR is assigned to the author who pushed the branch (`--assignee "@me"` or the commit author's handle). There is no auto-assign workflow in this repo; the owner-scope workflow only labels/needs the right reviewers per the CODEOWNERS map.

## Project Tracking

No org-level project automation is configured in this repo yet (issue #4, unverified). Do not claim a PR "moved to the project" — the human owner decides whether/when to wire project automation.

## Worked example

A PR fixing an api error-shape bug plus a regression test:

```bash
cat > /tmp/pr-body.md <<'EOF'
## What Problem This Solves
...
## User Impact
...
## Why This Change Was Made
...
## Evidence
...
EOF

gh pr create --base main --head fix/api-health-envelope --title "fix(api): return the shared error envelope" \
  --body-file /tmp/pr-body.md \
  --label bug --label task
rm -f /tmp/pr-body.md
```
