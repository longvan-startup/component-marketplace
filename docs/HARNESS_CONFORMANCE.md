# Agent Conformance, Efficiency, and Epic Review

Snapshot date: 2026-11-20

Repository baseline for PR E: `main` at `3209cb28a75261bc3f7c7e616ca0b9853a9c1898` (merge of PR #219)

Epic: [#161](https://github.com/longvan-startup/component-marketplace/issues/161)

## Scope and evidence rules

This is a bounded Phase 4 report. It uses the existing Phase 1 audit, merged PRs #216-#219, issue #161 comments, the current repository configuration, and one docs-only task handled by the Codex harness in T3 Code. No agent behavior is inferred from configuration alone. No batch agent run was made.

Use these terms separately:

| Term | Meaning |
|---|---|
| Configured | A repository file or tool setting names the instruction, skill, boundary, or gate. This does not prove that an agent read or followed it. |
| Observed | A session log, command, or result shows what happened in a real run. A manual file read is not proof of automatic instruction discovery. |
| Enforced | A test, hook, or host control blocks a violation. Text in Markdown is not enforcement. |

Status labels apply to the claim in that row. **PASS** means the cited evidence supports the claim. **FAIL** means an observed result contradicts it. **UNVERIFIED** means the available evidence cannot settle it, with the reason stated.

## Evidence from Phases 1-3

| Phase | Evidence | Current status |
|---|---|---|
| Phase 1, PR #216 | [Audit](HARNESS_AUDIT.md); merged as `e9ffcf7853133efc54b2379c9703f05bde00edbb`. The audit records baseline `43922e6952269118e1d199fa2eba430669528eb2`, HEAD `ffcae8315fddcd8d9c04740cfa695b8003dfb221`, inventory, R01-R32, gaps, and proposed ADRs. | PASS for the inventory and audit artifact. |
| Phase 2, PR #217 | [PR #217](https://github.com/longvan-startup/component-marketplace/pull/217), merged as `22f2b0f4c40c531f02d33f52944494e41a54d18f`. It normalized agent entrypoints and source-of-truth pointers. The PR reports host verification PASS and Docker UNVERIFIED. | PASS for the merged changes; runtime discovery remains UNVERIFIED. |
| Phase 2, PR #218 | [PR #218](https://github.com/longvan-startup/component-marketplace/pull/218), merged as `1e9f056aef670238f15f059f160cfd69b261db19`. Its skill table keeps web conventions for motion, including the GSAP policy, and limits task skills by trigger. Long recorded in an issue comment that the selection table was accepted with this merge. | PASS for the documented selection table. Runtime selection across agents remains UNVERIFIED. |
| Phase 3, PR #219 | [PR #219](https://github.com/longvan-startup/component-marketplace/pull/219), merged as `3209cb28a75261bc3f7c7e616ca0b9853a9c1898`. It adds database import-boundary tests, aligns the Postgres image, and includes `build:db` in CI. Its body reports host and isolated Docker verification PASS. | PASS for the stated enforcement and local evidence. The current PR list reports all required checks passing. |

All four PRs are merged and their checks are reported as passing in the repository PR list. The fetched PR metadata has no review decision, and no review-submission records were returned for #216-#219. Treat formal dual-owner approval of their decisions as UNVERIFIED unless an owner records it elsewhere. The issue comments do record Long's decisions about the skill table and the remaining ADRs.

## Agent conformance matrix

The shared repository policy lives in root `AGENTS.md`, `docs/ENGINEERING.md`, and `CONTRIBUTING.md`. The applicable scoped `AGENTS.md` adds domain limits. The shared `bun run boundary` and CI checks apply regardless of which client authored a change; they do not enforce instruction discovery, skill selection, worktree care, or ownership review.

| Agent | Instruction discovery, root and scoped policy | Skill selection | Ownership and boundaries | Worktree safety | Verification and evidence |
|---|---|---|---|---|---|
| Codex | **Configured PASS:** root `AGENTS.md` describes loading root-to-working-directory instructions, with a 32 KiB limit. **Observed PASS for explicit reads in this sample:** the current task opened root guidance and relevant policy files. **Automatic discovery UNVERIFIED:** an explicit read does not prove the client loaded files automatically. | **Configured PASS:** the task table is in root `AGENTS.md`. **Observed FAIL in this sample:** it opened the `antislop` core skill during a docs-only task, although the Docs row says not to load it. No visual craft or motion skill was opened. **Enforced UNVERIFIED:** no skill loader or rule blocks this mismatch. | `docs/ENGINEERING.md`, root instructions, and CODEOWNERS declare ownership; `bun run boundary` checks import edges in CI. **Enforced PASS for import rules only.** Owner approval is not enforced while ADR-03 remains pending. | **Configured PASS:** root instructions prohibit reset, stash, and overwriting unrelated changes. **Observed PASS in this task:** the original dirty checkout was left alone and work used a clean worktree from current `main`. No guard enforces this. | **Configured PASS:** root policy requires `bun run verify` and PASS/FAIL/UNVERIFIED reporting. **Observed:** see the bounded task table below. CI gates are enforced; report-label accuracy is not. |
| OpenCode | **Configured PASS:** root policy describes root `AGENTS.md` discovery; `opencode.json` lists `apps/*/AGENTS.md` and `packages/*/AGENTS.md`. The root file is not repeated in the glob. **Runtime UNVERIFIED:** no OpenCode session log was available. | **Configured PASS:** the shared task table applies. **Runtime UNVERIFIED:** no OpenCode skill-load trace was available. | Shared root policy and boundary CI apply. **Enforcement PASS** for the tested import graph, not for whether OpenCode follows ownership instructions. | Shared safety instructions are configured if discovered. **Runtime UNVERIFIED:** no OpenCode dirty-worktree sample was available; no guard is configured. | Shared verification policy and CI are configured. **Runtime UNVERIFIED:** no OpenCode verification report was available. |
| T3 Code | Root `CLAUDE.md` says T3 Code reads `AGENTS.md`; root `AGENTS.md` says there is no T3-specific repository config and marks runtime discovery unverified. **Configured UNVERIFIED:** the documentation claim is not backed by a T3-specific config or runtime trace. This session used T3 orchestration with a Codex harness, not a separate native T3 discovery test. | Shared task table is configured. **Runtime UNVERIFIED:** no native T3 skill-load trace was available. | Shared boundary CI applies. **Enforcement PASS** for import edges; agent-specific scope behavior is UNVERIFIED. | Shared safety policy is present in the repo. **Runtime UNVERIFIED** for a native T3 session; no guard is configured. | Shared verification policy and CI apply. **Runtime UNVERIFIED** for native T3 reporting. |
| Claude Code | **Configured PASS:** root `CLAUDE.md` imports root `AGENTS.md`; root and domain `CLAUDE.md` shims import their adjacent scoped instructions. **Runtime UNVERIFIED:** no Claude Code session log was available. | Shared task table is configured. **Runtime UNVERIFIED:** no Claude skill-load trace was available. | Shared root policy and boundary CI apply. **Enforcement PASS** for import edges only. A local Claude hook was reported in an issue comment, but it is not committed repo configuration and is not counted as project enforcement. | Shared safety policy is configured through the shims. **Runtime UNVERIFIED:** no Claude dirty-worktree trace was available. | Shared verification policy and CI apply. **Runtime UNVERIFIED:** no Claude verification report was available. |
| Cursor | **Configured UNVERIFIED:** this repository has no `.cursor/` directory or `.cursorrules`; native Cursor discovery of `AGENTS.md` was not tested. **Observed UNVERIFIED:** no Cursor session log was available. | Shared task table exists, but whether Cursor loads or follows it is **UNVERIFIED**. | Shared boundary CI applies after code is pushed. It does not prove Cursor respected domain ownership while editing. **Enforcement PASS** for import edges only. | No Cursor-specific worktree guard is configured. Whether Cursor reads the shared safety rule is **UNVERIFIED**; no session trace was available. | Shared verification gates apply in CI. Whether Cursor runs or accurately reports them is **UNVERIFIED**. |

### Bounded task checks

| Scenario | Configured expectation | Observed evidence | Enforcement | Status |
|---|---|---|---|---|
| Docs-only does not load UI skills | The Docs row in root `AGENTS.md` requires no task skill, allows `diagram-design` for Mermaid, and says not to load UI craft skills or `antislop`. | This docs-only run read seven skills for the PR workflow and prose review. It also opened the `antislop` core skill, which the Docs row excludes. No visual craft or motion skill was opened. | Skill choice is not automatically checked. | FAIL for this sample because one excluded skill was opened. |
| Web motion keeps web conventions and GSAP policy | Root skill table requires `web-conventions` and `antislop`, plus one motion skill. `apps/web/AGENTS.md` restricts GSAP to `lib/gsap.ts` and `useGsapScope`. | Static configuration was read. No web-motion task was run in this bounded sample. | Import boundary is CI-enforced. Skill choice and GSAP policy adherence are not. | UNVERIFIED at runtime. |
| Backend does not load frontend skills | Root skill table selects `api-conventions` for API work and excludes UI skills. | Static configuration was read. No backend task was run. | No skill-load enforcement. | UNVERIFIED at runtime. |
| Database does not import an app | PR #219 added negative fixtures for `packages/db` importing an app or another internal package; the PR reports 14/14 boundary tests and `bun run boundary` PASS. | The current full verification result for this PR E work is recorded below. | `bun run boundary` and CI block these import edges. | PASS when the local gate below passes. |
| Dirty worktree is preserved | Root `AGENTS.md` forbids reset, stash, or overwrite of unrelated changes. | The original checkout was dirty. Work was isolated in a new clean worktree based on `origin/main`; no destructive command was run against the original checkout. | No automated safeguard. | PASS for this task only; general client behavior is UNVERIFIED. |
| Verification labels match evidence | Root instructions require PASS, FAIL, or UNVERIFIED and say a skipped check is not a pass. | The first verify run failed because packages were not installed. It was reported as a failure, then rerun after `bun install --frozen-lockfile`. The final run passed; missing runtime evidence is labeled UNVERIFIED. | No PR-body linter or other reporting gate. | PASS for the observed report; labels are not machine-checked. |

### Efficiency measurement

This is one sample, not a before/after comparison. The available PR A-D records do not contain a comparable agent-session baseline for files opened, tool calls, runtime, or cost.

| Measure | Collected value | Limit |
|---|---|---|
| Instruction and policy files opened | 8: five agent entry/domain files, plus `docs/ENGINEERING.md`, `CONTRIBUTING.md`, and `docs/HARNESS_AUDIT.md`. | Explicitly read paths in the available session segment. This is not a record of automatic client discovery. |
| Skill files opened | 7. | Five workflow/review skills, `antislop`, and `antislop-copywriting`. The `antislop` read is the observed Docs-row violation above. |
| Other config files opened | 1: `opencode.json`. | Static read only. |
| Tool calls | 13 nested tool calls across six `functions.exec` batches through 09:54:26 UTC. | A provider handoff omitted earlier activity. This is the count in the visible bounded evidence window, not a full-thread total. |
| Runtime | 5 minutes 56 seconds from the current run's logged start at 09:48:30 UTC through 09:54:26 UTC. | This measures the evidence-collection window, not full authoring, verification, CI, or review. |
| Tokens or cost | UNVERIFIED. | The available host output supplied no token or cost counter. |
| Scope violations | One observed skill-selection mismatch; zero out-of-scope repository file edits in this docs-only change. | Does not measure rejected or unattempted edits. |
| Verification failures | 0 final gate failures. The first `bun run verify` attempt could not find installed packages; after `bun install --frozen-lockfile`, the full command passed. | The initial failure was environment setup, not a source failure. PR CI and owner review are separate. |
| Before/after efficiency comparison | UNVERIFIED. | No equivalent pre-change session metrics were recorded in PRs #216-#219. |

For future comparable measurements, log the same task type, starting commit, agent/model, exact instruction and skill paths opened, tool-call count from the full session trace, start/end timestamps, host token/cost figures when available, scope violations, and verification outcomes. Compare only samples with the same task scope and measurement method. Stop when one representative sample or a clear evidence gap answers the question.

## ADR status

| ADR | Status at PR E baseline | Evidence and decision needed |
|---|---|---|
| ADR-01, source of truth | PROPOSED. | PR #217 implemented entrypoint and policy pointers. The issue comment after PR #218 still lists ADR-01 as proposed. Long and Văn need to record approval or a reasoned deferral. |
| ADR-02, minimal skill loading | Accepted by Long in the issue comment after PR #218. | The selection table shipped in #218. A dual-owner formal review record was not present in the fetched PR metadata. This sample's `antislop` over-read remains a conformance failure, not a reason to rewrite PR C here. |
| ADR-03, main branch protection | PENDING OWNER APPROVAL. | PR #219 explicitly left the `main` commit hook and GitHub review protection unchanged. Do not claim owner review is enforced. Long and Văn must decide whether to enable a control or accept a documented deferral. |
| ADR-04, research and verification | PROPOSED. | The audit contains a proposed stop-and-evidence method. No later owner decision was found in the retrieved issue comments or PR #216-#219 records. Long and Văn need to record approval or a reasoned deferral. |

No owner-approved deferral record was found for ADR-01, ADR-03, or ADR-04. The responsible decision owners are Long and Văn together. The follow-up is to record each decision in issue #161. This report does not treat a pending decision as accepted.

## Issue #161 final acceptance review

Statuses below describe the evidence available at the PR E head. The epic remains open while any blocking criterion is failed or unverified.

| Acceptance Criterion | Evidence | Status | Remaining Risk | Decision |
|---|---|---|---|---|
| Complete inventory and commit baseline | PR #216 and `docs/HARNESS_AUDIT.md` record the baseline, audited HEAD, repositories, entrypoints, policies, CI and relevant controls. | PASS | Later changes need their own evidence. | Completed in Phase 1. |
| List duplicate, outdated, conflicting rules and impact | `docs/HARNESS_AUDIT.md` records R01-R32, evidence, risk, and recommendation; PRs #217-#219 address their scoped items. | PASS | The audit intentionally does not prove unobserved agent runtime. | Completed in Phase 1 and addressed in Phases 2-3. |
| Identify canonical source of truth for policy groups | Root `AGENTS.md`, `docs/ENGINEERING.md`, and `CONTRIBUTING.md` identify source files. ADR-01 remains PROPOSED. | UNVERIFIED | Owners have not recorded a decision accepting or deferring ADR-01. | Long and Văn to decide in #161. |
| Provide conformance matrix for the coding agents | This document covers Codex, OpenCode, T3 Code, Claude Code, and Cursor, and distinguishes configured, observed, and enforced states. | PASS | Four native runtime discovery/skill-selection paths remain unverified and are labeled as such. | Artifact complete; no runtime claim is made for those agents. |
| Clear skill triggers without indiscriminate loading | PR #218's table has task triggers and was accepted by Long in the issue comment. The current docs-only sample still read the excluded `antislop` core skill. | FAIL | Skill selection is policy-only; this sample shows one client session did not follow the Docs row. | Keep epic open; owners decide follow-up. PR E does not change PR C's skills. |
| Local and CI verification align while safety gates remain | PR #219 aligns the build and Postgres checks, preserves required check names, and reports host plus Docker PASS. Current local verification is listed below. | PASS | CI for PR E is pending until the PR runs. | Completed for Phases 1-3; require PR E CI before merge. |
| Measure efficiency or define a reusable method | The measurement table records observed counts and limits; audit §3.2 already defined a method. | PASS | No comparable before/after baseline or token/cost figure exists. | Method complete; make no savings claim. |
| Provide staged PR plan and rollback strategy | PRs #216-#219 follow the phased plan. PR E's rollback is to revert its documentation commit. | PASS | No deployment or product rollback applies to docs. | Complete. |
| Provide a reusable starter-kit proposal | `docs/HARNESS_STARTER_KIT.md` gives the four-layer model, templates, gates, checklist, and project-specific placeholders. | PASS | It is a design proposal, not a published template. | Complete in scope; no repository or package created. |
| Long and Văn review the decisions | PR #218's skill-table decision is recorded by Long. PR #221 requests Văn as reviewer. Long is the PR author, so GitHub cannot request him to review his own PR; his sign-off must be recorded separately. Fetched PR metadata for #216-#219 has no review decision, and no formal review submissions were returned. | UNVERIFIED | Joint approval for ADR-01, ADR-03, ADR-04 and this conformance finding is missing. | Keep epic open until owners decide. |
| Each PR records changed files and PASS/FAIL/UNVERIFIED | PR #217 and #219 list files and statuses. PR #216 does not use the required labels for the skipped full verify; PR #218 does not list changed files in its body. | FAIL | Merged historical PR bodies do not fully meet this criterion. | Do not claim retroactive compliance; owners decide whether this evidence gap blocks closure. |
| Close only after phases are approved complete or deferred with reasons | PR E is not yet owner-approved or merged. ADR-01, ADR-03, and ADR-04 remain proposed or pending, and criteria above have open failures. | UNVERIFIED | Closing now would contradict the issue's own gate. | Do not close #161. |

### Local verification for PR E

| Gate | Status | Evidence |
|---|---|---|
| `bun run verify` | PASS | `bun install --frozen-lockfile`, then `bun run verify`: lint passed (157 files), boundary passed, typecheck passed, 247 tests passed / 0 failed, and shared, db, API, and web builds passed. |
| PR required checks | UNVERIFIED | Checks run after PR creation. |
| Owner review | UNVERIFIED | Văn is requested as reviewer. Long is the PR author; his separate owner sign-off remains pending. |

## Deferred and out of scope

- Runtime discovery tests for OpenCode, native T3 Code, Claude Code, and Cursor were not run because this session has no corresponding session logs or clients. They remain UNVERIFIED, not deferred by owner agreement.
- The docs-only skill over-read and missing historical PR body details are not fixed here because PR E is documentation-only and PR C's skill triggers are explicitly out of scope. No PR F is proposed.
- ADR-01, ADR-03, and ADR-04 are not treated as approved or deferred. Long and Văn must record decisions before #161 can close.
- No branch protection, hooks, skills, CI, app code, database, API contract, or deployment configuration changed in PR E.
