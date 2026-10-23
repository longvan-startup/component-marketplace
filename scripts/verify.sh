#!/usr/bin/env bash
# =============================================================
# verify.sh — runs the full quality-gate suite (docs/ENGINEERING.md)
#
# For agents + devs, before commit/PR:
#   bun run verify              # lint + boundary + typecheck + test + build
#   bun run verify --docker     # + Docker runtime smoke
#   bun run verify --docker-only# gateway to CI parity: skip host gates
#
# Docker smoke isolation (P0): each run gets a UNIQUE compose project
# (cmp-verify-*) with NO host ports published; the trap cleanup removes only
# label-scoped resources of that project. Development volumes are untouched.
# Probes run inside containers — no dependence on host localhost.
# Probes print pass/fail only; no secret values are ever echoed.
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
FAILED=0

run_gate() {
  local name="$1"; shift
  echo "──────────────────────────────────────────"
  echo "▶ GATE: $name"
  echo "──────────────────────────────────────────"
  if "$@"; then
    echo "PASS: $name"
  else
    echo "FAIL: $name"
    FAILED=1
  fi
}

# --- Host gates ---
# --docker-only is for the CI docker job only (job already gated after quality).
_RUN_HOST_GATES=1
for _arg in "$@"; do
  if [[ "$_arg" == "--docker-only" ]]; then _RUN_HOST_GATES=0; fi
done

if [[ "$_RUN_HOST_GATES" == "1" ]]; then
  run_gate "Lint (Biome)" bun run lint
  run_gate "Boundary (workspace imports)" bun run boundary
  run_gate "Typecheck" bun run typecheck
  run_gate "Test (bun test)" bun test
  run_gate "Build (shared→api→web)" bun run build
fi

# --- Docker isolation smoke ---
if [[ "${1:-}" == "--docker" || "${1:-}" == "--docker-only" ]]; then
  # shellcheck source=./docker-smoke.lib.sh
  source "$(dirname "$0")/docker-smoke.lib.sh"

  run_gate "Compose version (>= 2.24 for isolation overlay)" smoke_require_compose_support
  run_gate "Compose validate (base + verify overlay, no host ports)" \
    docker compose -f compose.yaml -f compose.verify.yaml config -q

  SMOKE_PROJECT="$(smoke_project_name)"
  SMOKE_CLEANED=0
  # EXIT trap: removes ONLY resources labeled with the verify project. If the
  # script is interrupted (Ctrl-C, CI timeout) the same scoped cleanup runs.
  on_smoke_exit() {
    if [[ -n "$SMOKE_PROJECT" && "$SMOKE_CLEANED" == "0" ]]; then
      echo "◻ cleanup: removing verify project ${SMOKE_PROJECT} (label-scoped, dev volumes untouched)"
      smoke_cleanup "$SMOKE_PROJECT" >/dev/null 2>&1 || \
        echo "⚠ cleanup left resources in project ${SMOKE_PROJECT} (inspect with docker compose -p ${SMOKE_PROJECT} ps)"
    fi
  }
  trap on_smoke_exit EXIT

  echo "▶ Docker runtime smoke: project ${SMOKE_PROJECT} (up --build + in-container probes)"
  if docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml up -d --build >/dev/null 2>&1; then
    echo "PASS: Docker stack up (isolated project)"
  else
    echo "FAIL: docker compose up"
    docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml logs api web 2>/dev/null | tail -20 || true
    FAILED=1
  fi

  probe_wait() {
    # probe_wait <name> <service> <url> <grep>
    local name="$1" service="$2" url="$3" pattern="$4"
    local ok=0
    for _ in $(seq 1 45); do
      if docker compose -p "$SMOKE_PROJECT" exec -T "$service" wget -qO- "$url" 2>/dev/null | grep -q "$pattern"; then
        ok=1; break
      fi
      sleep 2
    done
    if [[ "$ok" == "1" ]]; then echo "PASS: Docker runtime — $name"
    else
      echo "FAIL: Docker runtime — $name did not match within 90s"
      docker compose -p "$SMOKE_PROJECT" logs "$service" 2>/dev/null | tail -20 || true
      FAILED=1
    fi
  }
  probe_wait "API /health" api "http://127.0.0.1:4000/health" '"status":"ok"'
  probe_wait "API /health/db (real Postgres connection)" api "http://127.0.0.1:4000/health/db" '"database":"connected"'
  probe_wait "Web /" web "http://127.0.0.1:3000/" "Component Marketplace"

  # --- DB migration smoke on the throwaway DB (blank volume) ---
  if docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml run --rm migrate >/dev/null 2>&1; then
    echo "PASS: DB migration smoke — drizzle-kit migrate applied on blank volume"
  else
    echo "FAIL: DB migration smoke — drizzle-kit migrate exited non-zero"
    docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml logs migrate 2>/dev/null | tail -20 || true
    FAILED=1
  fi

  # --- DB migration smoke on the throwaway DB (blank volume) ---
  tables=""; psql_dbg=""
  # Prefer the fully-resolved -f pair (same model the stack was created with).
  tables="$(docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml exec -T postgres \
    psql -U postgres -d "${POSTGRES_DB:-component_marketplace}" -tAc \
    "SELECT tablename FROM pg_tables WHERE schemaname='public'" 2>&1 || true)"
  # Fallback: plain base compose (service running in that project either way).
  if [[ -z "$tables" ]]; then
    tables="$(docker compose -p "$SMOKE_PROJECT" exec -T postgres \
      psql -U postgres -d "${POSTGRES_DB:-component_marketplace}" -tAc \
      "SELECT tablename FROM pg_tables WHERE schemaname='public'" 2>&1 || true)"
    psql_dbg="fallback exec used; primary exec returned empty"
  fi
  if echo "$tables" | grep -qx users && echo "$tables" | grep -qx components; then
    echo "PASS: DB migration smoke — public.users + public.components exist"
  else
    echo "FAIL: DB migration smoke — expected tables missing"
    echo "  psql result: [${tables}] (${psql_dbg})"
    echo "  diagnostic: $(docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml exec -T postgres psql -U postgres -d component_marketplace -tAc "SELECT current_database(), current_schema()" 2>&1 || true)"
    FAILED=1
  fi

  # Idempotency: a second migrate run against the same DB must be a no-op (exit 0).
  if docker compose -p "$SMOKE_PROJECT" -f compose.yaml -f compose.verify.yaml run --rm migrate >/dev/null 2>&1; then
    echo "PASS: DB migration smoke — second migrate run is a no-op (idempotent)"
  else
    echo "FAIL: DB migration smoke — second migrate run not idempotent"
    FAILED=1
  fi

  if [[ "$FAILED" == "0" ]]; then
    echo "◻ cleanup: removing verify project ${SMOKE_PROJECT} (label-scoped, dev volumes untouched)"
    if smoke_cleanup "$SMOKE_PROJECT" >/dev/null 2>&1; then
      SMOKE_CLEANED=1
      echo "PASS: Docker cleanup — verify project removed; other compose projects unaffected"
    else
      echo "⚠ cleanup returned non-zero (leftovers may exist in ${SMOKE_PROJECT})"
    fi
  fi
fi

echo "══════════════════════════════════════════"
[[ $FAILED -eq 0 ]] && echo "ALL GATES PASS ✔" || echo "ONE OR MORE GATES FAILED ✘"
exit $FAILED
