#!/usr/bin/env bash
# =============================================================
# docker-smoke.lib.sh — shared helpers for isolated compose smoke runs.
# Source-only library (no direct execution).
#
# Isolation contract (P0 — docs/ENGINEERING.md):
#   - Every smoke run uses a UNIQUE compose project (`cmp-verify-*`).
#   - Cleanup is `down -v --remove-orphans` scoped to that project: docker
#     compose labels every volume/container it creates with the project name,
#     so only resources CREATED by the verify project are removed.
#   - No `docker system prune` / global cleanups, ever.
# =============================================================

# Minimum compose version supporting `!override` merge tags (isolation overlay).
_min_compose_version="2.24"

smoke_require_compose_support() {
  local version major minor
  version="$(docker compose version --short 2>/dev/null | sed 's/^v//' || true)"
  if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "docker compose CLI not available or unreadable (got: '${version:-nothing}')"
    return 1
  fi
  major="${version%%.*}"
  minor="$(echo "$version" | cut -d. -f2)"
  # Numeric floor: any version whose (major, minor) >= (2, 24) understands
  # the merge/override tags used by compose.verify.yaml (Compose 2.x labels
  # and newer v3+/v5+ stacks both satisfy this).
  if (( major < 2 )) || { (( major == 2 )) && (( minor < 24 )); }; then
    echo "docker compose v$version too old — need >= $_min_compose_version for compose.verify.yaml merge tags"
    return 1
  fi
  return 0
}

smoke_project_name() {
  echo "cmp-verify-$(date +%s)-$RANDOM"
}

# smoke_cleanup <project> [base] [overlay] — removes ALL resources created by
# that project only. Label-scoped by compose; never touches other projects'
# volumes/containers. Base/overlay default to the repo verify pair; tests may
# override both.
smoke_cleanup() {
  local project="$1"
  local base="${2:-compose.yaml}"
  local overlay="${3:-compose.verify.yaml}"
  docker compose -p "$project" -f "$base" -f "$overlay" down -v --remove-orphans
}
