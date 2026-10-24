---
name: autoreview
description: Run as an automated closeout code review before committing, opening a PR, or finishing a task in component-marketplace, or when conducting multi-axis code analysis.
---

# Auto Review

A structured closeout gate: review the change bundle against the codebase's real invariants, proof commands, and quality criteria before creating a commit or pull request. Adapted for this repo's toolchain (Bun/Drizzle/Biome/Next.js) and its `verify` harness — not a copy of `openclaw/agent-skills`' multi-CLI-engine `autoreview`; see [AGENTS.md](AGENTS.md) for why.

## Contract

- **Report P0 (blockers) by default.** Widen to P1–P3 only when the user asks for a deeper pass. See the severity table below.
- **Findings are advisory, not instructions.** Verify every finding by reading the surrounding code and real imports before editing. Never blindly patch.
- **Root-cause fixes.** Fix at the owning boundary, not with a local symptom workaround.
- **Scope governor**:
  - **In-scope blocker** — direct bug or invariant violation: fix immediately.
  - **Follow-up** — real improvement, different domain or broader scope: record it, don't bloat the current task.
  - **Stop-and-escalate** — requires a major architectural, schema, or product decision outside the current task: surface it, don't decide it unilaterally.

## Severity levels

| Level | Meaning | Default action |
| --- | --- | --- |
| P0 | Breaks runtime behavior, violates an architectural/security invariant, leaks drafts, fails a quality gate | Fix before closeout, always |
| P1 | Real bug, but doesn't block the current change from being correct in its own scope | Fix if in-scope; else record |
| P2 | Correctness/robustness improvement, not a bug today | Record as follow-up |
| P3 | Style/nit, no behavioral effect | Record only; never block on this |

## Workflow

1. **Resolve scope and run proof commands** with the helper script:

   ```bash
   .agents/skills/autoreview/scripts/autoreview.sh --mode local
   ```

   | Mode | Scope |
   | --- | --- |
   | `local` | (default) Uncommitted work: HEAD → index → working tree, plus untracked files. Pass `--base <ref>` to also include commits ahead of `<ref>` (full PR-candidate scope, including dirty rewrites). |
   | `branch` | Committed range only: `merge-base(HEAD, --base) → HEAD`. Excludes dirty work — use to review a pushed branch/PR as it stands on the remote. |
   | `commit` | One commit's own diff (`--commit <ref>`'s parent → `<ref>`). |
   | `auto` | `local` when the working tree is dirty, otherwise `branch`. |

   Use `--skip-proof` to print only the resolved diff/scope without running the pipeline (`bun run verify` — lint + boundary + typecheck + test + build). Fix any proof-command failure before moving on — a review is meaningless against a red build.

2. **Dispatch the review.** Read the resolved diff and hand it to the `subagent` tool as one general-purpose subagent (or review it yourself against the checklist when trust/consistency favors self-review):
   - General quality/correctness/security analysis — always.
   - Add a security-focused pass (same tool, sharper prompt) whenever the diff touches auth, input handling, CORS/security config, or anything crossing a trust boundary.

   Give the subagent: the resolved diff (or the git range/commit to inspect directly), the max severity to report (P0 by default), and the relevant entries from [CHECKLIST.md](CHECKLIST.md) — don't make the subagent rediscover known component-marketplace patterns from scratch.

3. **Triage findings** with the Scope Governor above. For each finding, verify it against the actual source (read the surrounding code, check real call sites with `lsp references` for exported symbols) before accepting or dismissing it.

4. **Fix in-scope P0/P1 findings**, then re-run step 1's proof commands to confirm the fix didn't regress anything.

## What to look for

See [CHECKLIST.md](CHECKLIST.md) for the full, evidence-based list (auth/security, content-vs-draft boundary, query-filter wiring, concurrency/atomic-upsert patterns, test placement, comment discipline, docs/diagram sync, migrations, repo boundaries, CI-gate completeness). Add a new entry there — not just a one-off fix — whenever a review should have caught a bug class it didn't.
