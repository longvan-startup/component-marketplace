# syntax=docker/dockerfile:1

# ============================================================
# API (Bun + Express) — multi-stage build
# ============================================================

# --- Stage 1: deps (cài dependencies cho cả monorepo) ---
FROM oven/bun:1.4 AS deps
WORKDIR /app
COPY tsconfig.base.json tsconfig.base.json
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN bun install --frozen-lockfile

# --- Stage 2: builder (compile TypeScript) ---
FROM deps AS builder
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api
ENV NODE_ENV=production
RUN bun run --cwd apps/api build

# --- Stage 3: runner (production deps + dist, không source, không secrets) ---
FROM oven/bun:1.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000

RUN addgroup --system --gid 1001 app \
  && adduser --system --uid 1001 --ingroup app appuser

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY --from=builder /app/bun.lock bun.lock
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/apps/api/dist apps/api/dist
# Workspace package @marketplace/shared được tham chiếu runtime qua symlink node_modules
COPY --from=builder /app/packages/shared packages/shared
# @marketplace/db: bun runtime chạy TS source qua exports (packages/db/src)
COPY --from=builder /app/packages/db packages/db

USER appuser
EXPOSE 4000

CMD ["bun", "apps/api/dist/index.js"]
