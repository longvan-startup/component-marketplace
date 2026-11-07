#!/usr/bin/env bash
set -u

if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  exit 1
fi

if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" || -z "${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
  exit 1
fi

if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- . \
  ':(exclude)prototypes/deployment-dashboard/**' \
  ':(exclude)docs/DEPLOYMENT.md' \
  ':(exclude,top)package.json' \
  ':(exclude,top)bun.lock' \
  ':(exclude)scripts/vercel-ignore-marketplace-build.sh'; then
  exit 0
fi

exit 1
