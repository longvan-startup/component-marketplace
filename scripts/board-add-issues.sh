#!/usr/bin/env bash
#
# board-add-issues.sh — bulk-import every OPEN issue of the repo onto the org
# Marketplace Board (GitHub Projects v2). Companion of docs/KANBAN.md §1/§4.
#
# WHY: the native project "Add repository item" workflow only catches NEW
# issues — backlog issues (created before the board) must be imported once.
#
# Requirements (owner-side, see docs/KANBAN.md §1):
#   - PROJECT_ID: GraphQL node id of the Marketplace Board project (PVT_...)
#   - BOARD_TOKEN: PAT with `project` scope (the automation token in CI is
#     deliberately narrower and cannot touch org projects)
#   - gh CLI authenticated (or GH_TOKEN) with repo read for listing issues
#
# Usage:
#   PROJECT_ID=PVT_xxx BOARD_TOKEN=ghp_xxx bash scripts/board-add-issues.sh
#
# Safe to re-run: items already on the board are skipped (GraphQL returns an
# ALREADY_EXISTS-style error; treated as done).

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID (Marketplace Board GraphQL node id, PVT_...)}"
BOARD_TOKEN="${BOARD_TOKEN:?set BOARD_TOKEN (PAT with project scope)}"

REPO="${REPO:-longvan-startup/component-marketplace}"
API="https://api.github.com/graphql"

post_query() {
  local query="$1"
  curl -sS -H "Authorization: token $BOARD_TOKEN" \
    -H 'Content-Type: application/json' -H 'User-Agent: board-add-issues' \
    -d "{\"query\": $(printf '%s' "$query" | jq -Rs .)}" "$API"
}

# 1. List OPEN issues (fetch both node_id and title; only issues, not PRs —
#    the issues endpoint returns PRs too, filtered by pull_request key).
issues=$(gh api "repos/$REPO/issues?state=open&per_page=100" \
  --jq '.[] | select(.pull_request == null) | [.node_id, (.number | tostring), .title] | @tsv')

if [[ -z "$issues" ]]; then
  echo "No open issues — nothing to import."
  exit 0
fi

added=0
skipped=0
while IFS=$'\t' read -r node_id number title; do
  query="mutation { addProjectV2ItemById(input:{ projectId: \"$PROJECT_ID\", contentId: \"$node_id\" }) { item { id } } }"
  response=$(post_query "$query")
  if echo "$response" | grep -q '"errors"'; then
    if echo "$response" | grep -qiE 'already|exists|InProject'; then
      skipped=$((skipped + 1))
      echo "SKIP  #$number ($title) — already on board"
    else
      # Real failure: surface it but keep importing the rest (partial success
      # is better than stopping at the first board hiccup; exit 1 at the end).
      echo "ERROR #$number ($title) — $(echo "$response" | head -c 200)"
      status=1
    fi
  else
    added=$((added + 1))
    echo "ADD   #$number ($title)"
  fi
done <<< "$issues"

echo "Import finished: ${added} added, ${skipped} already present."
exit "${status:-0}"
