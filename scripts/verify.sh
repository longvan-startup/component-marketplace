#!/usr/bin/env bash
# =============================================================
# verify.sh — chạy toàn bộ quality gates (docs/ENGINEERING.md)
#
# Dùng cho agent + dev trước khi commit/PR:
#   bun run verify            # lint + typecheck + test + build
#   bun run verify --docker   # + Docker runtime smoke (compose up + probe)
#
# Probe trả 0/1, không in nội dung; key metrics in ra cuối để copy vào PR body.
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

run_gate "Lint (Biome)" bun run lint
run_gate "Typecheck" bun run typecheck
run_gate "Test (bun test)" bun test
run_gate "Build (shared→api→web)" bun run build

if [[ "${1:-}" == "--docker" ]]; then
  run_gate "Compose validate" docker compose config -q
  echo "▶ Docker runtime smoke (up --build + probe)... "
  docker compose up -d --build > /dev/null 2>&1 || { echo "FAIL: docker compose up"; FAILED=1; }

  probe_api=""
  for _ in $(seq 1 45); do
    if docker compose exec -T api wget -qO- http://127.0.0.1:4000/health 2>/dev/null | grep -q '"status":"ok"'; then
      probe_api="ok"; break
    fi
    sleep 2
  done
  if [[ "$probe_api" == "ok" ]]; then
    echo "PASS: Docker runtime — API /health"
  else
    echo "FAIL: Docker runtime — API /health không đạt trong 90s"
    docker compose logs api | tail -20 || true
    FAILED=1
  fi

  if docker compose exec -T web wget -qO- http://127.0.0.1:3000/ 2>/dev/null | grep -q 'Component Marketplace'; then
    echo "PASS: Docker runtime — Web /"
  else
    echo "FAIL: Docker runtime — Web / không trả nội dung mong đợi"
    docker compose logs web | tail -20 || true
    FAILED=1
  fi

  docker compose down -v > /dev/null 2>&1 || true
fi

echo "══════════════════════════════════════════"
[[ $FAILED -eq 0 ]] && echo "ALL GATES PASS ✔" || echo "ONE OR MORE GATES FAILED ✘"
exit $FAILED
