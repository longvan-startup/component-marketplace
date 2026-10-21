# syntax=docker/dockerfile:1

# ============================================================
# Web (Next.js) — multi-stage build
# ============================================================

# --- Stage 1: deps (cài dependencies cho cả monorepo) ---
# Pin đúng .bun-version (1.4.3) — CI (setup-bun) và Docker phải dùng cùng một phiên bản
FROM oven/bun:1.4.3 AS deps
WORKDIR /app
COPY tsconfig.base.json tsconfig.base.json
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

# --- Stage 2: builder (build Next.js standalone) ---
FROM deps AS builder
COPY packages/shared packages/shared
COPY apps/web apps/web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN bun run --cwd apps/web build

# --- Stage 3: runner (image tối giản, không source, không secrets) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
