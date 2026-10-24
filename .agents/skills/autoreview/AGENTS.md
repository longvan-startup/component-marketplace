# Autoreview Skill — Maintenance Notes

- **Scope**: this skill is local to `component-marketplace`. Unlike `openclaw/agent-skills`' `autoreview` (which is synced verbatim across multiple downstream repos and wraps external Codex/Claude/Amp/Pi/Kimi CLI engines), this version is written specifically for this repo's toolchain (Bun/Drizzle/Biome/Next.js) and its verify-based proof pipeline; run the review yourself or hand findings to a reviewer subagent. Do not vendor updates from `openclaw/agent-skills` verbatim — that skill's engine-orchestration surface (multi-CLI auth, sandbox isolation, Codex/Astra model selection) does not apply here.
- **Files**:
  - [SKILL.md](SKILL.md) — the contract and execution workflow; read this first.
  - [CHECKLIST.md](CHECKLIST.md) — project-specific findings patterns, expanded as real bugs are found. Add an entry here (with the file/pattern that triggered it) instead of only fixing the one-off instance.
  - [scripts/autoreview.sh](scripts/autoreview.sh) — resolves the git review scope (local/branch/commit/auto) and runs the proof-command pipeline. Update this script, not `SKILL.md`'s prose, when a proof command in `package.json` changes.
- **Update policy**: when a new bug class is fixed in this repo that a review should have caught (e.g. a pagination join bug, a silently-ignored filter, a missing auth check), add a checklist entry to `CHECKLIST.md` in the same change — this skill should get harder to fool over time, not stay static.
- **No CI dependency**: `scripts/autoreview.sh` is a local developer/agent tool, not a CI job. CI enforces its own gates (`.github/workflows/ci.yml`); this skill exists so an agent (or a human) can run the same checks _before_ pushing.
