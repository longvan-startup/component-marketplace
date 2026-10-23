#!/usr/bin/env bash
# =============================================================
# test-compose-isolation.sh — POSITIVE PROOF that verify.sh docker cleanup
# cannot touch a development compose project.
#
# Method:
#   1. Start a "development-like" throwaway compose project (cmp-isodev-*)
#      with its own named volume containing a sentinel file.
#   2. Start a second verify-like project (cmp-isover-*) with its own volume.
#   3. Call the EXACT cleanup function used by verify.sh (smoke_cleanup)
#      against ONLY the verify-like project.
#   4. Assert:
#      - the dev-like project's container is still running and its sentinel
#        volume data survives;
#      - the verify-like project's volumes are gone (label-scoped removal).
#
# Exit 0 = isolation proven; any assertion failure exits 1.
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=./docker-smoke.lib.sh
source "$(dirname "$0")/docker-smoke.lib.sh"

smoke_require_compose_support

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mk_project_compose() { # <file> <volume-name>
  cat >"$1" <<EOF
services:
  app:
    image: busybox:1.36
    command: ["sleep", "180"]
    volumes:
      - ${2}:/data
volumes:
  ${2}: {}
EOF
}

PASS=0
ok() { PASS=$((PASS+1)); echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# 1) development-like project with sentinel data
DEV_PROJ="cmp-isodev-$(date +%s)-$RANDOM"
mk_project_compose "$TMP/dev.yaml" devdata
docker compose -p "$DEV_PROJ" -f "$TMP/dev.yaml" up -d >/dev/null 2>&1
docker compose -p "$DEV_PROJ" -f "$TMP/dev.yaml" exec -T app \
  sh -c 'echo DEV_SENTINEL > /data/dev-sentinel' >/dev/null 2>&1
if [[ "$(docker compose -p "$DEV_PROJ" exec -T app cat /data/dev-sentinel)" == "DEV_SENTINEL" ]]; then
  ok "dev-like project up, sentinel readable"
else
  fail "dev-like project sentinel setup"
fi

# 2) verify-like project (the kind verify.sh creates and cleans up)
VER_PROJ="cmp-isover-$(date +%s)-$RANDOM"
mk_project_compose "$TMP/ver.yaml" verdata
docker compose -p "$VER_PROJ" -f "$TMP/ver.yaml" up -d >/dev/null 2>&1
ok "verify-like project up (project=${VER_PROJ})"

# 3) the exact cleanup function used by verify.sh against ONLY the verify project
smoke_cleanup "$VER_PROJ" "$TMP/ver.yaml" "$TMP/ver.yaml" >/dev/null 2>&1
ok "smoke_cleanup ran against ${VER_PROJ} only"

# 4) assertions
docker compose -p "$DEV_PROJ" -f "$TMP/dev.yaml" ps -q app | grep -q . \
  && ok "dev container still running" || fail "dev container was stopped/removed"
[[ "$(docker compose -p "$DEV_PROJ" -f "$TMP/dev.yaml" exec -T app cat /data/dev-sentinel)" == "DEV_SENTINEL" ]] \
  && ok "dev sentinel DATA survived the cleanup (volume untouched)" \
  || fail "dev volume data was affected by cleanup"
leftover="$(docker volume ls -q --filter "label=com.docker.compose.project=${VER_PROJ}")"
[[ -z "$leftover" ]] && ok "verify project volumes removed (label-scoped)" \
  || fail "verify project volume still exists: ${leftover}"
devvol="$(docker volume ls -q --filter "label=com.docker.compose.project=${DEV_PROJ}")"
[[ -n "$devvol" ]] && ok "dev project volume still present: ${devvol}" \
  || fail "dev project volume missing before its own cleanup"

# 5) our own teardown (both projects are this test's children)
docker compose -p "$DEV_PROJ" -f "$TMP/dev.yaml" down -v --remove-orphans >/dev/null 2>&1 || true

echo "══════════════════════════════════════════"
echo "ISOLATION PROVEN: ${PASS} checks passed — cleanup never touches other projects"
