#!/usr/bin/env bash
# Resolves the review scope for component-marketplace's autoreview skill and (unless
# --skip-proof) runs the project's proof-command pipeline against it. Prints
# the resolved diff stat, the untracked-file list, and a pass/fail summary a
# `task` reviewer subagent (or a human) can act on. This script never edits
# the repository and never dispatches the actual review — see SKILL.md for
# how to hand the resolved scope to the `reviewer`/`security-reviewer` agents.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: autoreview.sh [--mode local|branch|commit|auto] [--base <ref>]
                      [--commit <ref>] [--max-priority P0|P1|P2|P3]
                      [--skip-proof] [--help]

Modes (default: local):
  local            Uncommitted work only: HEAD -> index -> working tree,
                    plus untracked files. Pass --base to also include every
                    commit ahead of <ref> (a full PR-candidate scope,
                    including dirty rewrites).
  branch           Committed range only: merge-base(HEAD, --base) -> HEAD.
                    Excludes the dirty working tree. Use to review a pushed
                    branch/PR as it actually stands on the remote.
  commit           One commit's own diff: <ref>'s parent -> <ref> (an
                    empty-tree diff for a root commit).
  auto             `local` (against HEAD) when the working tree is dirty,
                    otherwise `branch` against --base.

Options:
  --base <ref>     Base ref for local/branch/auto modes. Default: main.
  --commit <ref>   Commit to review in --mode commit. Default: HEAD.
  --max-priority   Highest severity the reviewer should report: P0 (default,
                    blockers only) through P3 (style/nit). Recorded in the
                    summary only -- pass it through to the reviewer prompt.
  --skip-proof     Print the resolved scope only; skip the format/lint/
                    verify pipeline.
  --help           Show this help and exit.
EOF
}

MODE="local"
BASE=""
COMMIT="HEAD"
MAX_PRIORITY="P0"
RUN_PROOF=1

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --base)
      BASE="$2"
      shift 2
      ;;
    --commit)
      COMMIT="$2"
      shift 2
      ;;
    --max-priority)
      MAX_PRIORITY="$2"
      shift 2
      ;;
    --skip-proof)
      RUN_PROOF=0
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$MODE" in
  local | branch | commit | auto) ;;
  *)
    echo "Invalid --mode: $MODE (expected local|branch|commit|auto)" >&2
    exit 2
    ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

BASE_EXPLICIT=1
if [ -z "$BASE" ]; then
  BASE="main"
  BASE_EXPLICIT=0
fi

is_dirty() {
  [ -n "$(git status --porcelain)" ]
}

if [ "$MODE" = "auto" ]; then
  if is_dirty; then
    MODE="local"
  else
    MODE="branch"
  fi
fi

echo "== autoreview: resolving scope =="
echo "mode: $MODE"
echo "max-priority: $MAX_PRIORITY"

case "$MODE" in
  local)
    if [ "$BASE_EXPLICIT" -eq 1 ]; then
      DIFF_BASE="$BASE"
      echo "scope: $BASE -> index -> working tree (pinned base, includes commits ahead of $BASE)"
    else
      DIFF_BASE="HEAD"
      echo "scope: HEAD -> index -> working tree (dirty-only)"
      echo "(pass --base <ref> to widen this to every commit ahead of <ref>, PR-candidate style)"
    fi
    git diff --stat "$DIFF_BASE"
    echo "-- untracked files --"
    git status --porcelain --untracked-files=all | awk '$1 == "??" { print $2 }'
    ;;
  commit)
    if git rev-parse --verify --quiet "${COMMIT}^" >/dev/null; then
      DIFF_BASE="${COMMIT}^"
    else
      DIFF_BASE="$(git hash-object -t tree /dev/null)"
      echo "note: $COMMIT has no parent (root commit) -- diffing against the empty tree"
    fi
    echo "scope: $DIFF_BASE -> $COMMIT"
    git diff --stat "$DIFF_BASE" "$COMMIT"
    ;;
  branch)
    MERGE_BASE="$(git merge-base HEAD "$BASE")"
    echo "scope: merge-base($BASE) -> HEAD (committed only, excludes dirty work)"
    git diff --stat "$MERGE_BASE"...HEAD
    ;;
esac

if [ "$RUN_PROOF" -eq 0 ]; then
  echo "== autoreview: --skip-proof set, not running the proof pipeline =="
  exit 0
fi

echo
echo "== autoreview: running proof pipeline =="

FAILED=0
run_step() {
  local label="$1"
  shift
  echo "-- $label --"
  if ! "$@"; then
    echo "FAILED: $label" >&2
    FAILED=1
  fi
}

run_step "verify (lint+boundary+typecheck+test+build)" bun run verify

echo
if [ "$FAILED" -eq 0 ]; then
  echo "== autoreview: proof pipeline PASSED =="
  exit 0
else
  echo "== autoreview: proof pipeline FAILED (see above) =="
  exit 1
fi
