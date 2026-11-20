# Harness audit — Phase 1

Audit date: 2026-11-20. Scope is inventory and recommendations only. This document does not change agent rules, skills, hooks, or CI.

Status of every check below is **PASS**, **FAIL**, or **UNVERIFIED**.

- **Declared:** the sentence exists in a file that was read.
- **Implemented:** a script, hook, workflow, or API field exists. File text alone is not implementation.
- **Enforced:** a test, hook, or API response showed the control fire. Reading a file that *would* skip a path is not enforcement. That case stays **UNVERIFIED** until a fixture runs.
- **PASS / FAIL** on a file or API read means that observation, not that a production bug was reproduced.

## 1. Baseline

| Item | Value |
|---|---|
| Audited HEAD | `ffcae8315fddcd8d9c04740cfa695b8003dfb221` |
| Subject | `Merge pull request #214 from longvan-startup/feat/mobile-expo-client` (2026-11-20 14:04 +0700) |
| Issue baseline | `43922e6952269118e1d199fa2eba430669528eb2` (2026-11-15, PR #160) |
| Ancestry | `43922e6` is an ancestor of HEAD. PASS |
| Workspaces on HEAD | `apps/web`, `apps/mobile`, `apps/api`, `packages/shared`, `packages/db` |

Harness-relevant commits after the issue baseline: mobile client and boundary registration (`a409ffe`), Control Room removal (`eeb2c0f`), Vercel release hardening (`432b3d4`, `56208fc`, `815cfbd`, `2817d99`), and one learnings-log entry (`6a36be8`). Product code after the baseline (catalog, auth, pricing) makes the "skeleton only" sentence in `docs/ENGINEERING.md` false. The audit includes `apps/mobile`. It does not re-audit product behavior.

Local dirty trees were left untouched: `/home/ubuntu/component-marketplace` on `refactor/long-component-card-mvc`, and `/home/ubuntu/component-marketplace-mobile` on `feat/mobile-catalog`.

Inventory coverage: every root and domain `AGENTS.md` / `CLAUDE.md`, `opencode.json`, the 27 `SKILL.md` descriptions, `lefthook.yml`, `scripts/verify.sh`, `scripts/check-boundaries.mjs`, `.github/workflows/ci.yml`, `.github/CODEOWNERS`, and the live `main` branch protection API. Individual skill bodies were not read line by line. That limit is called out where a finding depends on it.

## 2. Executive summary

The enforced core is small and real: Biome, the boundary script, `bun test`, typecheck, build, Docker smoke, commitlint, and two required CI checks. Most agent behavior is Declared only. GitHub does not require a pull request review, so CODEOWNERS does not block a merge.

Three facts should be fixed in later PRs, not in this one:

1. `docs/ENGINEERING.md` still says the repo is a skeleton with no business logic.
2. `AGENTS.md` lists a large craft-skill set for web UI and also says to load only relevant skills. This audit did not record an agent session, so it does not claim those files were loaded.
3. `lefthook.yml` has no `main` check. Branch protection blocks force-push and requires CI. It does not require a reviewer. A commit on `main` was not attempted.

External references worth adapting later are small and selective: Pocock's user-invoked versus model-invoked split, pstack's "prove it" and "guard the context window" principles, and Osmani's source-cited research plus a router skill. Do not install those repositories. Do not adopt pstack's multi-agent `poteto-mode` for a two-person team.

## 3. Evidence and enforcement matrix

| ID | Rule | Source | Scope | Declared | Implemented | Enforced | Evidence | Risk | Decision | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| R01 | No business logic until a task exists; repo is still a skeleton | `docs/ENGINEERING.md:8` | Repo | Yes | No | FAIL | Auth, catalog, pricing, and `apps/mobile` are on HEAD `ffcae83` | Agents refuse work that already shipped, or treat the repo as empty | UPDATE | Replace the sentence in PR B. Point at `docs/PRODUCT.md` for scope |
| R02 | Three policy files do not copy each other | `docs/ENGINEERING.md:3` | Docs | Yes | Partial | UNVERIFIED | Engineering owns gates, CONTRIBUTING owns git flow, AGENTS owns agent behavior. Skills restate the same gates | Agents follow a stale copy | MERGE | PR C: skills link to ENGINEERING instead of restating gates |
| R03 | Report gates only as PASS / FAIL / UNVERIFIED | `docs/ENGINEERING.md:67`, `AGENTS.md` | Agents | Yes | No | UNVERIFIED | Text only. No linter checks PR bodies | False "done" claims | KEEP | Keep the words. Do not automate in Phase 1 |
| R04 | Web and mobile import only `@marketplace/shared` | `scripts/check-boundaries.mjs:42-52` | `apps/web`, `apps/mobile` | Yes | Yes | PASS | CI step `bun run boundary`. Negative tests in `scripts/check-boundaries.test.ts` | Client reaches the database | KEEP | Leave the script |
| R05 | API must not import web or mobile | `scripts/check-boundaries.mjs:6,54-57` | `apps/api` | Yes | Yes | PASS | Same script and tests | UI types leak into the API | KEEP | Leave the script |
| R06 | Shared has zero internal dependencies | `scripts/check-boundaries.mjs:59-64` | `packages/shared` | Yes | Yes | PASS | Same script | Contract starts importing Drizzle | KEEP | Leave the script |
| R07 | `packages/db` must not import apps | `packages/db/AGENTS.md` | `packages/db` | Yes | No | UNVERIFIED | `DOMAINS` has no `packages/db` key (`scripts/check-boundaries.mjs:42-64`). `checkSpecifier` returns null when `domainOf` misses (lines 148-149). No fixture was run | A db file might import an app without a boundary failure. Not demonstrated | UPDATE | PR D: add the domain and a failing test before calling this enforced |
| R08 | `bun run verify` is lint, boundary, typecheck, test, build | `scripts/verify.sh:42-46` | Local | Yes | Yes | PASS | Gate names match `docs/ENGINEERING.md:52-58` | Drift between the script and the doc | KEEP | When a gate changes, edit both in one PR |
| R09 | Typecheck includes mobile | `package.json` script `typecheck` | `apps/mobile` | Yes | Yes | PASS | CI job `quality` runs `bun run typecheck` (`.github/workflows/ci.yml:60`) | Mobile type errors skip CI | KEEP | Update the comment at `ci.yml:58`, which still says shared + api + web |
| R10 | `bun run build` includes `build:db` | `package.json:14-16` | Local build | Yes | Yes in `package.json`. CI job does not call it | UNVERIFIED | CI runs `build:shared`, `build:api`, and `build:web` (`ci.yml:69-72`). It does not run `build:db`. `bun run typecheck` does include `packages/db`. No emit-only break was produced | A db emit error might pass CI. Not demonstrated | UPDATE | PR D: add `build:db` or record why `tsc --noEmit` is enough |
| R11 | Docker smoke is isolated and required | `scripts/verify.sh`, `ci.yml` job `docker-runtime` | CI | Yes | Yes | PASS | Required check name `Docker build & runtime smoke` on `main` | A merge without a bootable API | KEEP | Do not rename the check |
| R12 | Quality job is a required check | Branch protection API | `main` | Yes | Yes | PASS | `required_status_checks.contexts` includes `Lint / Typecheck / Test / Build`, `strict: true`, `enforce_admins: true` | Red main | KEEP | Do not rename the check |
| R13 | Compose Postgres is 17 | `docs/ENGINEERING.md:75`, `compose.yaml` | Docker | Yes | Yes for compose | UNVERIFIED | Compose image is `postgres:17-alpine`. CI service image is `postgres:16-alpine` (`ci.yml:21`). No test was run on both | Version skew might hide a failure. Not demonstrated | UPDATE | PR D: one version, named in ENGINEERING |
| R14 | Bun 1.4.3 is pinned in three places | `.bun-version`, both Dockerfiles | Toolchain | Yes | Yes | PASS | `.bun-version` is `1.4.3`. `docker/api.Dockerfile` and `docker/web.Dockerfile` use `oven/bun:1.4.3`. CI reads `.bun-version` | Image and CI drift | KEEP | Keep the three-place rule |
| R15 | Biome is the only formatter | `docs/ENGINEERING.md:25`, `lefthook.yml` | Repo | Yes | Yes | PASS | `pre-commit` runs `bun run lint`. CI runs the same command | Unformatted merges if `--no-verify` is used | KEEP | Document that `--no-verify` bypasses it |
| R16 | Commit messages are Conventional Commits | `lefthook.yml` `commit-msg` | Commits | Yes | Yes | PASS | `bunx commitlint --edit` | History that CI cannot classify | KEEP | Leave commitlint |
| R17 | Do not commit directly on `main` | `AGENTS.md` (no direct push), CONTRIBUTING branch rule, issue #161 comment by Văn | Local git | Partial | No | UNVERIFIED | `lefthook.yml` has lint and commitlint only. No `lefthook-local.yml` in the repo. A commit on `main` was not attempted in this audit | The hook may allow the commit. Not demonstrated here | UPDATE | ADR-03. Implement in PR D if owners accept |
| R18 | CODEOWNERS review is required | `docs/ENGINEERING.md:20`, `.github/CODEOWNERS:2-3` | GitHub | Yes | File exists | FAIL | Protection payload `required_pull_request_reviews` is `null`. Ruleset count is 0 | One person can merge without the other owner | UPDATE | ADR-03. Turn on reviews only after both owners agree |
| R19 | CI and `scripts/` need both owners | `.github/CODEOWNERS` | Those paths | Yes | File exists | FAIL | Same as R18. The file names the reviewers. GitHub does not require them | Harness edits merge with no second review | UPDATE | Same switch as R18 |
| R20 | Secrets stay out of git | `docs/ENGINEERING.md:28`, `.gitignore:14-16` | Repo | Yes | Partial | UNVERIFIED | `.env` is ignored. No secret scanner in `lefthook.yml` or CI | A forced add of `.env` is not blocked | KEEP | Do not add a scanner in Phase 1. PR D may add one |
| R21 | Web UI skill set in `AGENTS.md` | `AGENTS.md:74-97` | `apps/web` UI | Yes | No loader | UNVERIFIED | Three different facts, not one load event. **Listed:** eight craft skills plus the antislop family. **Named in the minimum sentence:** `web-conventions`, `antislop`, and "relevant craft skills" (`AGENTS.md:93-94`). **Actually loaded:** no session trace in this audit | The prose can be read as a large required set. This audit did not measure a session | UPDATE | ADR-02. PR C replaces the two paragraphs with one table. Do not claim tokens until Phase 4 |
| R22 | Load only relevant skills, never all and never none | `AGENTS.md:68` | Agents | Yes | No loader | UNVERIFIED | The sentence is next to the minimum list. Whether an agent treats "relevant craft skills" as all eight names is not observed | Prose can be read two ways. No session shows a contradiction in behavior | MERGE | One table. Keep R22 as the intended rule until that table exists |
| R23 | antislop stops UI work until the user answers when to apply it | `.agents/skills/antislop/SKILL.md:12` | Any UI | Yes | No | UNVERIFIED | The line is in the skill. This audit did not replay a UI task to prove every agent stops | A clear task stalls, or the agent ignores the skill | UPDATE | PR C: delete the stop-and-ask. Keep the visual filter |
| R24 | OpenCode loads scoped AGENTS via globs | `opencode.json:3`, `AGENTS.md:49-50` | OpenCode | Yes | Yes | UNVERIFIED | Glob is `apps/*/AGENTS.md` and `packages/*/AGENTS.md`, so `apps/mobile` matches. Behavior was last marked verified 2026-10-22, before mobile existed | A client upgrade stops loading the glob | KEEP | Re-verify when OpenCode is upgraded. Do not claim the 2026-10-22 note covers mobile |
| R25 | Codex concatenates AGENTS.md up to 32 KiB | `AGENTS.md:51` | Codex | Yes | No | UNVERIFIED | Combined domain files are 22626 bytes (`wc -c` on root + five domain files). Under the cap today. Skill bodies are extra and were not counted | Mobile plus a long web file later drops db rules | UPDATE | PR B: put safety rules first. Re-measure after edits |
| R26 | Claude Code reads `CLAUDE.md` shims | `CLAUDE.md`, domain shims | Claude | Yes | Yes | UNVERIFIED | Shims exist for root, web, mobile, api, shared, and db. Each shim imports `AGENTS.md`. Not executed in this audit | A domain without a shim is invisible to Claude | KEEP | New domain PR must add the shim, as mobile did |
| R27 | T3 Code and Cursor discover the same scoped files | `AGENTS.md:55-57` | T3, Cursor | Partial | No | UNVERIFIED | T3 line says to ask the tool owner. No `.cursor/` or `.cursorrules` in the repo | Cursor may see only the root file | UPDATE | ADR-01 records the gap. Do not invent a Cursor config in Phase 1 |
| R28 | Mobile owner, boundary, and typecheck | CODEOWNERS, ENGINEERING, boundary script, `apps/mobile/AGENTS.md` | Mobile | Yes | Yes | PASS for those three | Owner Văn. Allow-list is shared only. Typecheck is in the CI command | A later edit drops mobile from `typecheck` and the CI comment stays wrong | KEEP | PR B only fixes the stale CI comment |
| R29 | Mobile is not in `bun run build` or EAS | `docs/ENGINEERING.md:56`, `apps/mobile/AGENTS.md` | Mobile | Yes | Yes | PASS | `package.json` `build` has no mobile step. No `eas.json` | Someone adds a simulator to `verify` and breaks Linux CI | KEEP | Leave store builds out |
| R30 | Do not push `main`, do not self-merge, do not deploy from an agent | `AGENTS.md` | Agents | Yes | No | UNVERIFIED | Text only. GitHub blocks force-push (`allow_force_pushes.enabled` is false) and blocks deleting `main` | An agent with a token can still open a normal merge | KEEP | Social rule stays. R18 is the missing technical half |
| R31 | Migrations are append-only | `packages/db/AGENTS.md` | Database | Yes | No | UNVERIFIED | No CI job diffs migration history. Not tested here | A rewritten migration ships | KEEP | PR D can add a check. Not in this PR |
| R32 | Learnings log is append-only and is not a second policy | `AGENT_LEARNINGS.md:1-12` | Agents | Yes | Yes as a file | UNVERIFIED | Entries exist, including 2026-10-21 Docker workspace copy and 2026-11 chained-branch note (`6a36be8`) | Agents treat anecdotes as current law | KEEP | Do not copy learnings into AGENTS.md |

## 3.1 Skill inventory

Count: 27 `SKILL.md` files under `.agents/skills/`. Evidence for every row is the YAML `description` plus, where noted, `AGENTS.md:68-97`. Bodies were not scored. **Loaded in a session: UNVERIFIED for all 27.** No hook records which skill an agent opened.

Classes: `entry` (named in the minimum sentence), `listed` (named in a group, not in that sentence), `filter`, `workflow`.

| Skill | Trigger in the description | Scope | AGENTS.md | Overlap | Class |
|---|---|---|---|---|---|
| `web-conventions` | Any `apps/web` feature | Web | Minimum for web UI | Restates boundary and verify | entry |
| `antislop` | "Load always" in the description; minimum sentence names it for web UI | UI prose | Minimum for web UI | Parent of the five `antislop-*` files | entry |
| `api-conventions` | Any backend work | `apps/api`, `packages/db` | Minimum for backend | Overlaps `api-design`, `backend-patterns` | entry |
| `changing-the-database-schema` | Schema or Drizzle migration | `packages/db` | Minimum when a migration is touched | Overlaps `packages/db/AGENTS.md` | entry |
| `figma-design-verification` | Figma Plugin API read or write | Figma | Minimum for that task | None of the other 26 are a Plugin API check | entry |
| `git-commit` | User asks to commit | Git | Minimum for every commit | Overlaps `branch-and-document`, commitlint | entry |
| `github-pr` | Opening or editing a PR | GitHub | Minimum for every PR | Overlaps `git-commit` body template | entry |
| `antislop-ui` | Building or editing an interface | UI | Listed in the filter family | Overlaps `frontend-design`, `better-interface` | filter |
| `antislop-code` | Comment hygiene | Comments | Listed | None on product code if the skill is followed | filter |
| `antislop-copywriting` | Headlines, CTAs, prose | Copy | Listed | Overlaps `antislop` | filter |
| `antislop-human` | Contrast, keyboard, focus | A11y | Listed | Overlaps `better-interface`, `design-review` | filter |
| `antislop-layoutmobile` | Layout from phone to desktop | Layout | Listed | Overlaps `adapt` | filter |
| `frontend-design` | Distinctive UI | Web UI | Listed in the craft group | Overlaps `emil-design-eng`, `antislop-ui` | listed |
| `emil-design-eng` | UI polish and motion | Web UI | Listed | Overlaps `interaction-design`, `apple-design` | listed |
| `apple-design` | Gesture, spring, materials | Web UI | Listed | Overlaps `interaction-design` | listed |
| `interaction-design` | Microinteractions | Web UI | Listed | Overlaps `emil-design-eng`, `reactbits` | listed |
| `adapt` | Breakpoints and devices | Web UI | Listed | Overlaps `antislop-layoutmobile` | listed |
| `beautiful-shadows` | Elevation and shadow | Web UI | Listed | Overlaps `frontend-design` | listed |
| `reactbits` | Animated React bits | Web UI | Listed | Overlaps `interaction-design`. Web AGENTS names GSAP, not this pack | listed |
| `design-review` | Critique of a URL, image, or component | Review | Listed | Overlaps `better-interface` | listed |
| `better-interface` | Accessibility, layout, type, color | Review | Listed | Overlaps `design-review`, `antislop-human` | listed |
| `api-design` | REST shape, status, pagination | API design | Listed under Backend | Overlaps `api-conventions` | listed |
| `backend-patterns` | Node, Express, Next API data access | API | Listed under Backend | Examples are Next handlers. This API is Express | listed |
| `branch-and-document` | Before code changes or PRs | Git, docs | Listed under workflow | Overlaps `git-commit`, `CONTRIBUTING.md` | workflow |
| `autoreview` | Before commit, PR, or finish | Review | Listed under workflow | Overlaps `verifying-monorepo-changes` | workflow |
| `verifying-monorepo-changes` | Before commit, PR, or when CI disagrees | Verify | Listed under workflow | Overlaps `docs/ENGINEERING.md` gates | workflow |
| `diagram-design` | Mermaid only, no PNG | Docs | Listed under workflow | None | workflow |

The minimum sentence does not say "open all eight craft files". It says "relevant craft skills". Counting eight as mandatory would go past the text. Counting zero as compliant would ignore the list above that sentence. Phase 4 is how to see what an agent actually opens.

## 3.2 Phase 4 measurement

Not run in this PR. Method for a later pass:

| Sample task | Touch | Done when |
|---|---|---|
| Docs-only | One sentence in `docs/` | PR body lists files read |
| Web UI | One component in `apps/web` | Same |
| API | One route in `apps/api` | Same |
| Migration | One column in `packages/db` | Same, and no apply against production |
| Shared contract | One additive zod field | Same |
| Figma | Read-only, or skip if no file key | UNVERIFIED if no file |
| CI | A comment in `.github/workflows/ci.yml` only if an owner asks | Otherwise UNVERIFIED |

For each task and each agent that actually runs it, record:

- Files opened. Count paths, not a guess.
- Tool calls. Count from the session log.
- Tokens or cost. Record the host figure. If the host does not show one, write UNVERIFIED. Do not estimate.
- Skills opened, compared with the minimum sentence and with section 3.1. "Not opened" is an observation. "Should have opened" is not.
- The epic checks: right instructions, right owner, no dirty-worktree wipe, checks that match the task, no extra scope, report label PASS / FAIL / UNVERIFIED.

One agent, one task, then stop. Do not fan out. Do not run the seven tasks in the audit PR.

## 4. Duplicates, stale text, and text-only guardrails

Stale, and safe to correct in PR B:

- `docs/ENGINEERING.md:8` skeleton sentence (R01).
- `.github/workflows/ci.yml:58` typecheck comment omits db and mobile (R09).
- `AGENTS.md:47` "verified 2026-10-22" does not cover `apps/mobile` (R24).

Text that can be read two ways, or that disagrees with a file or API read:

- R21 lists eight craft skills. R22 says load only relevant skills. No session shows both firing. The clash is in the prose.
- R23 tells the agent to stop and ask before UI work. Whether a running agent does that is UNVERIFIED.
- ENGINEERING and CODEOWNERS describe code-owner review as the GitHub control. The protection API shows reviews are not required (R18). That API read is the evidence. A merge without a review was not performed in this audit.

Text-only, leave in place until an owner asks for a tool:

- PASS / FAIL / UNVERIFIED reporting (R03).
- No direct push to `main` (R30), except the force-push block which is real.
- Append-only migrations (R31).
- Skill selection (R21, R22).

## 5. Instruction discovery

| Agent | What the repo configures | Mobile visible | This audit |
|---|---|---|---|
| OpenCode | Root `AGENTS.md` plus `opencode.json` globs | Yes, by `apps/*` | Config PASS. Runtime UNVERIFIED |
| Codex | Concatenated `AGENTS.md`, 32 KiB cap declared | Yes, if the walk includes `apps/mobile` | Size of domain files PASS under the cap. Runtime UNVERIFIED |
| Claude Code | `CLAUDE.md` shim per domain | Yes, `apps/mobile/CLAUDE.md` | Files PASS. Runtime UNVERIFIED |
| T3 Code | Root text says verify with the tool owner | UNVERIFIED | No repo config |
| Cursor | No `.cursor/` and no `.cursorrules` | UNVERIFIED | No repo config |

`opencode.json` does not list the root `AGENTS.md`. The root file says OpenCode loads it on its own. That split was not re-tested.

## 6. Ownership

| Path | Declared owner | CODEOWNERS | Review actually required |
|---|---|---|---|
| `apps/web/`, `apps/mobile/` | Văn | Văn | No |
| `apps/api/`, `packages/db/`, `packages/shared/`, `docs/`, root `AGENTS.md` | Long, via `*` | Long | No |
| `.github/workflows/`, `scripts/`, `docker/`, `compose.yaml`, `deploy/` | Both | Both | No |
| `.agents/skills/` | Long, via `*` | Long only | No |

Shared's own `AGENTS.md` asks for the opposite owner on contract changes. That is a review convention, not a GitHub requirement.

## 7. Local verify versus CI

| Check | `bun run verify` | CI `quality` | CI `docker-runtime` |
|---|---|---|---|
| Biome | Yes | Yes | No |
| Boundary | Yes | Yes | No |
| Typecheck, including mobile | Yes | Yes, via the same script | No |
| `bun test` | Yes | Yes, with `TEST_DATABASE_URL` | No |
| `build:db` | Yes | No | No |
| API and web build | Yes | Yes, as two steps | Image build inside smoke |
| Docker smoke | Only with `--docker` | No | Yes, `verify.sh --docker-only` |
| Postgres | 17 in compose | 16 for integration tests | 17 via compose |

Required check names, read from the API: `Lint / Typecheck / Test / Build` and `Docker build & runtime smoke`. Renaming either one is a release break. This PR does not touch them.

## 8. External references

No installer was run. No skill was copied. SHAs were read with `gh api` on 2026-11-20.

### Matt Pocock skills

- Source: https://github.com/mattpocock/skills at `abeeaf95660ba9e8b7c753eb38f441ca707a8823`.
- Files read: `README.md`, `AGENTS.md`, `.agents/invocation.md`, directory `skills/engineering/`.
- Mechanism, from those files: skills are small and bucketed (`engineering`, `productivity`, `misc`, `in-progress`, `deprecated`). Promoted skills must be listed in the README. Each skill is either user-invoked (`disable-model-invocation: true`) or model-invoked. A user-invoked skill cannot be called by another skill. `ask-matt` is the router. Subagents are supposed to start with a fresh context.
- We already have small skill files and a written "only relevant skills" rule. We do not have an invocation bit. The minimum sentence names some skills and leaves "relevant craft skills" undefined (R21). Whether an agent loads them is UNVERIFIED.
- Proposal: **ADOPT LATER** the user-invoked versus model-invoked bit and one router, in PR C. **REJECT** installing the plugin or `npx skills add`. **REJECT** copying `tdd`, `to-spec`, and `grill-with-docs` until a task needs them. Our issues already carry scope and verify sections.

### pstack

- Mirror: https://github.com/backnotprop/pstack at `4a4f41c46c67a006658ac17cef2d092593f6b26a`.
- Upstream: https://github.com/cursor/plugins at `aaeb0ea3a0584995aa8f55ce44c6c5259414b896`, path `pstack/`.
- Files read: both READMEs, mirror `MIRROR.md`, both skill directory listings. SHA-256 of `skills/tdd/SKILL.md` and `skills/principle-prove-it-works/SKILL.md` matched. `skills/no-comments/SKILL.md`, `skills/statechart/SKILL.md`, and `README.md` differed. That matches the mirror's claim of harness-neutral edits plus two community fixes, for those files only. The other skills were not hashed.
- Author claim, not re-executed: `poteto-mode` runs many principles and can spawn subagents. The mirror says each standalone skill works alone, and some skills require companions.
- We already have boundary checks, `bun run verify`, and a written evidence rule. We do not have pstack's principle pack.
- Proposal: **ADAPT** later, as short principles, `principle-prove-it-works`, `principle-guard-the-context-window`, and `principle-subtract-before-you-add`. They match R03 and the written goal of not deleting guards to save tokens. **REJECT** `poteto-mode`, `swarm`, and `arena` for this team. A two-person repo does not have evidence that multi-agent fan-out is cheaper than one agent plus CI. **REJECT** `npx skills add`.

### Addy Osmani agent-skills

- Source: https://github.com/addyosmani/agent-skills at `8c99fa36d90068c82d547f7c12a9d67a3e95f4ee`.
- Files read: `README.md` through the skill index, and the `skills/` directory listing (26 names). Skill bodies were not executed.
- Author claim: 10 lifecycle commands route into skills. `using-agent-skills` is the router. `source-driven-development` asks for official docs and an unverified flag. `context-engineering` says to load rules at the right time. `doubt-driven-development` is an adversarial second pass. The README also says a one-skill install can miss repo-level `references/` (issue 361 in that repo). That install bug was not reproduced here.
- We already have task templates, `verifying-monorepo-changes`, and `api-conventions`. We do not have a research stop rule. This audit is the example: three repos, pinned SHAs, then stop.
- Proposal: **ADAPT** the research loop in ADR-04, and the idea of one router skill. **ADOPT LATER** only if PR C needs a written trigger table. **REJECT** installing all 26 skills. **REJECT** treating the README's "production-grade" label as proof the workflows work in this repo.

## 9. Four-layer model

The layers are a reading order, not a new directory tree. Phase 1 does not move files.

| Layer | Owns | Today | Gap |
|---|---|---|---|
| 1. Core safety | Secrets, no force-push to `main`, do not destroy dirty worktrees, do not weaken CI names | Scattered in `AGENTS.md`, ENGINEERING, gitignore, branch protection | R17, R18, R20 are not one page. Commit on `main` is unblocked |
| 2. Repository policy | Stack, ownership, gates, branch flow | `docs/ENGINEERING.md`, `CONTRIBUTING.md`, CI | R01 is false. R12 and R13 disagree about Postgres. R18 overstates GitHub |
| 3. Domain instructions | web, mobile, api, shared, db | Five `AGENTS.md` files plus Claude shims | db outbound imports are outside the boundary map (R07). Discovery differs by agent (R27) |
| 4. Task skills | One skill set per task | 27 skills, prose index in root `AGENTS.md` | No invocation bit. R21 and R22 are both prose. Actual loads are UNVERIFIED. R23 can stall a clear task if an agent follows that line |

A task should read layer 1 and 2 always, layer 3 for the directories it touches, and layer 4 only for the matching trigger. R22 states that. R21's list is easy to read as a larger set. This audit did not watch an agent choose.

## 10. ADRs

### ADR-01 — Source of truth

**PROPOSED — OWNER REVIEW REQUIRED**

| Topic | Owner file | If it disagrees with |
|---|---|---|
| What the product is | `docs/PRODUCT.md` | ENGINEERING's skeleton sentence loses |
| Gates, ownership, toolchain | `docs/ENGINEERING.md` | A skill or a CI comment loses, and the comment gets edited |
| Branch, commit, PR text | `CONTRIBUTING.md` | Agent skills lose |
| What an agent may do | Root `AGENTS.md` | Domain files add limits. They do not grant extra write scope |
| Import edges | `scripts/check-boundaries.mjs` | Markdown loses when CI is green and the doc is stale |
| Who GitHub asks to review | `.github/CODEOWNERS` plus the live protection API | A sentence that says "protection is on" loses until the API shows reviews required |

When two docs disagree, the agent reports the clash and follows the owner file. It does not invent a third rule.

### ADR-02 — Minimal skill loading

**PROPOSED — OWNER REVIEW REQUIRED**

Guardrails that stay even if unread as skills: R04–R06, R08, R11, R12, R15, R16, R20. Those are scripts and CI, not optional reading.

| Task | Read | Do not read unless the task asks |
|---|---|---|
| Web UI | `web-conventions`, `antislop`, `antislop-ui` | The other seven craft skills, unless the task names motion, Figma, or a design review |
| Mobile UI | `apps/mobile/AGENTS.md`, `antislop`, `antislop-ui` | Web GSAP rules, EAS docs |
| API | `api-conventions` | `api-design` and `backend-patterns` unless the task is a new public route |
| Migration | `changing-the-database-schema`, `packages/db/AGENTS.md` | Product RFCs that are still PENDING |
| Shared contract | `packages/shared/AGENTS.md` and the domain on the other side | Craft skills |
| Docs only | Root `AGENTS.md` plus the doc being edited | All skills |
| Figma Plugin API | `figma-design-verification` | The rest of the craft list |
| CI / scripts | `verifying-monorepo-changes` | Deploy skills that do not exist yet |

`antislop` remains a filter. The proposal is to delete the instruction that stops work to ask when the filter applies.

### ADR-03 — Main branch protection

**PROPOSED — OWNER REVIEW REQUIRED**

| Layer | Stops | Bypass | Now |
|---|---|---|---|
| Agent hook in `.claude/` | Claude edits and some git writes on `main` | Other agents. `--no-verify` is irrelevant because the hook is not git | Not in the repo. Văn tested a local copy. UNVERIFIED here |
| `lefthook.yml` | `git commit` on `main` for every tool that runs hooks | `git commit --no-verify`, rebase, cherry-pick, a merge that does not commit through the hook | Not implemented |
| GitHub protection | Force-push, deleting `main`, merging when the two required checks are red, including admins | A green PR with no reviewer. A local commit that is never pushed | PASS for checks and force-push. FAIL for reviews |

Recommendation: do not commit agent-specific hooks as the only control. If owners want a local stop, add it to `lefthook.yml` in PR D with a test that a commit on `main` exits non-zero, plus a documented escape that is not a casual `--no-verify`. Turn on "require a pull request review" only as a separate owner decision, because it changes how both people merge.

### ADR-04 — Research and verification

**PROPOSED — OWNER REVIEW REQUIRED**

Loop: question, source, check, compare, decide, verify, stop.

| Situation | Source |
|---|---|
| How this repo behaves | The file or the command on HEAD. External blogs do not override it |
| Library or host behavior | Official docs, with a version. If the doc and the installed code disagree, the installed code wins for this repo and the doc is quoted |
| Another team's agent skills | Read-only reference. Record the SHA. Do not install |
| The same claim in two repos | Prefer the file hash over the README |
| No primary source after two fetches | UNVERIFIED. Do not keep searching |

Stop when the next fetch cannot change the decision, or when the task's output is a document or a patch and the evidence section can be written. This audit stopped after the README, the skill index, and three hashed pstack files.

## 11. Later PRs

| PR | Phase | Allowed change | Rollback |
|---|---|---|---|
| A | 1 | This file only | Revert the doc commit |
| B | 2 | Correct R01, the CI comment, and the discovery paragraph. No skill deletes | Revert. CI names stay |
| C | 2 | Skill trigger table and the antislop stop-and-ask line | Revert the skill files. Scripts stay |
| D | 3 | Boundary domain for `packages/db`, Postgres version alignment, optional `build:db` in CI, optional lefthook main check | Revert before renaming any required check. Never rename R11 or R12 in the same PR |
| E | 5 | A starter sketch that strips Figma ids, owner logins, Neon, and Vercel | Do not publish a new repository until both owners say so |

Security, production deploy, and migrations stay out of B–E unless the PR names them and both owners approve.

## 12. UNVERIFIED

- Runtime discovery for OpenCode, Codex, Claude Code, T3 Code, and Cursor.
- Whether every agent actually stops on the antislop question.
- Which skills an agent opens on a real task. Section 3.2 is the method. It was not run.
- Token counts or dollar cost. No host figure was available.
- A fixture run proving `packages/db` can import an app without a boundary failure. The code path is visible. The test was not executed.
- Secret-scanner absence beyond reading `lefthook.yml` and `ci.yml`.
- pstack skills other than `tdd`, `principle-prove-it-works`, `no-comments`, `statechart`, and the README.
- Bodies of the 26 Osmani skills and the Pocock skill bodies beyond `invocation.md` and the directory listing.
- Branch protection for repositories other than this one. Ruleset list for this repo returned length 0.

## 13. Files checked

`AGENTS.md`, `CLAUDE.md`, `opencode.json`, `AGENT_LEARNINGS.md`, `docs/ENGINEERING.md`, `CONTRIBUTING.md` (named as the process owner, not re-copied), domain `AGENTS.md` and `CLAUDE.md` for web, mobile, api, shared, and db, `.agents/skills/*/SKILL.md` frontmatter, `lefthook.yml`, `package.json`, `.bun-version`, `compose.yaml`, `docker/api.Dockerfile`, `docker/web.Dockerfile`, `.gitignore`, `scripts/verify.sh`, `scripts/check-boundaries.mjs`, `scripts/check-boundaries.test.ts` (existence and the mobile cases added in `a409ffe`), `.github/workflows/ci.yml`, `.github/CODEOWNERS`, GitHub branch protection for `main`.

External URLs are in section 8. No script from those repositories was executed.
