# Deployment & CD — current state and activation runbook

Source of truth for CDN/CD. Status verified with real commands (latest check:
2026-10-24). Every change after this date must update the verified-state table.

## Verified state (2026-10-24)

| Item | Status | How verified |
|---|---|---|
| CI (`ci.yml`) | green on main (lint+boundary+typecheck+test+build+docker isolation+DB migration smoke) | `gh run list` |
| CD workflow (`cd.yml`) | publishes api image to GHCR; production steps gated by repo secrets | workflow source |
| GHCR publish | ready to run — uses built-in `GITHUB_TOKEN`, runs automatically after CI-green main push | workflow source |
| Repo secrets | to be created by owner when activating each layer | `gh api repos/.../actions/secrets` |
| Web deploy target | **Vercel Services project** (`vercel.json` merged in #46: api internal + web public, binding `API_URL_INTERNAL`, same-origin `/api` fallback) — **activation is one dashboard import** (owner-manual, tracked on the issue board) | merged PR #46 |
| API deploy target | **VPS + SSH auto-deploy**, gated by secrets `SSH_HOST/SSH_USER/SSH_KEY` (owner decision) | decision |
| Production DB | **Neon**, migrate job gated by secret `PROD_DATABASE_URL` (owner decision) | decision |
| Branch protection `main` | `enforce_admins=false` (must be re-enabled), `require_code_owner_reviews=false`, approvals=1 | `gh api .../branches/main/protection` |

## Pipeline flow (on main push, after CI green)

```
CI green on main
   └─► cd.yml (workflow_run)
        ├─ 1. docker-publish  → ghcr.io/longvan-startup/cmp-api:{sha-*,latest}
        ├─ 2. db-migrate      → runs `drizzle-kit migrate` against Neon
        │     (SKIPPED with notice while PROD_DATABASE_URL is absent;
        │      refuses localhost URLs as a dev-DB safety guard)
        └─ 3. deploy-vps      → ssh: docker compose pull + up + /health assert
              (SKIPPED with notice while SSH secrets are absent)
```

Each layer activates independently the moment its secret(s) exist — no code
changes needed.

## 1. Vercel Services — one project, api + web (no secrets in GitHub)

Current layout: root `vercel.json` defines two services — `api` (`apps/api`,
Express, internal) and `web` (`apps/web`, Next.js, public); top-level rewrites
route `/api/(.*)` → api and `/(.*)` → web. The web service declares a binding
to api which injects the internal base URL as `API_URL_INTERNAL` (read by
`apps/web/lib/api-client.ts` for SSR calls). The api also stays reachable
publicly with the same path prefix it sees (`/api/health`, …) — the Express
routes are mounted under `/api` **in addition to** `/` when `VERCEL` is set,
so Docker/VPS behavior is unchanged.

Manual one-time setup (Vercel dashboard):

1. Browse <https://vercel.com> → Add New… → Project → **Import** the
   `longvan-startup/component-marketplace` GitHub repo (install the Vercel
   GitHub App for the `longvan-startup` org — org owner approves).
   The `vercel.json` committed at the repo root drives the services config;
   leave Root Directory unset (services carry their own roots).
2. Environment Variables for the **api** service: `DATABASE_URL` = Neon pooled
   connection string (gated DB; unset ⇒ `/health` still OK, `/health/db` 503
   by design). No Web variables needed: browser calls default to same-origin
   `/api`, SSR calls use the injected binding.
3. Local parity: `vercel dev` runs both services and injects the binding
   (CLI ≥ 47.0.5).
4. Done: every PR gets a **preview** deployment (both services, preview-scoped
   binding); pushes to `main` produce production deploys with Instant Rollback.

Nothing in this repo calls the Vercel API; no deploy secrets exist by design.

### VPS path (§2) — status under Services

The GHCR + VPS deploy layer stays valid independently (deploy/manifest
unchanged, job gated by SSH secrets). It can be activated as a second
transport for the api (e.g. self-hosted fallback or WebSocket hosting for the
chat milestone M3) while Vercel serves the public `/api/*` surface. Keeping
both is a small-cost option; deactivating the VPS path means never setting its
secrets.

## 2. API — GHCR + VPS auto-deploy

One-time VPS preparation (Mắt Bão or any Docker-capable host):

```bash
ssh <user>@<vps>
mkdir -p /opt/cmp-api && chmod 700 /opt/cmp-api
# copy the manifest + env template from the repo:
scp deploy/vps/compose.yaml deploy/vps/.env.example <user>@<vps>:/opt/cmp-api/
# on the VPS, fill /opt/cmp-api/.env (chmod 600; never committed):
#   DATABASE_URL=<Neon connection string>
#   GHCR_TOKEN=<PAT with read:packages scope>
#   # optional: API_BIND / API_PORT
```

Then create repo secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|---|---|
| `SSH_HOST` | VPS hostname/IP |
| `SSH_USER` | SSH user |
| `SSH_KEY` | private key (Ed25519 recommended; add public key to VPS) |
| `SSH_PORT` | optional; defaults to 22 |

Behavior: after CI-green pushes to main, the workflow does
`docker login ghcr.io` (PAT from VPS `.env`) → `pull` → `up -d` → asserts
`/health` from localhost. On failure it exits non-zero with the log command.
Rollback: `API_IMAGE=ghcr.io/longvan-startup/cmp-api:sha-<old>` in `.env`
(compose pins image via var), then `docker compose up -d`.

Reverse proxy (nginx/caddy) terminates TLS and forwards to
`127.0.0.1:${API_PORT:-4000}` — out of CD scope, one-time infra step.

## 3. Production DB — Neon (gated migrate)

1. Create the Neon project (fixcas — owner action in the Neon console).
2. Copy the **pooled** connection string (`...neon.tech/dbname?sslmode=require`).
3. Add repo secret `PROD_DATABASE_URL` with that value.
4. The CD `db-migrate` job then runs automatically ahead of every VPS deploy:
   `drizzle-kit migrate` (forward-only; applied migrations are never edited).
   Migrations apply BEFORE the new container starts (`needs` ordering), then
   deploy-vps only proceeds on `success` or `skipped` — never on migrate failure.

Safety rails in the job: refuses `localhost`/`127.0.0.1` URLs; announces a
skip notice instead of failing while the secret is absent.

## Secrets & permissions summary

| Where | Values | Note |
|---|---|---|
| GitHub repo secrets | `PROD_DATABASE_URL`, `SSH_HOST`, `SSH_USER`, `SSH_KEY`, (`SSH_PORT`) | all optional; each enables its CD layer |
| Vercel dashboard | `NEXT_PUBLIC_API_URL` (per environment) | never stored in GitHub |
| VPS `.env` | `DATABASE_URL`, `GHCR_TOKEN`, binds/ports | chmod 600, never committed |
| GHCR | built-in `GITHUB_TOKEN` (publish), PAT read:packages (VPS pulls) | repo-scoped |

## Rollback

| Layer | Method |
|---|---|
| Web | Vercel Instant Rollback ( Immutable deployments) |
| API | pin previous sha tag via `API_IMAGE` in VPS `.env`, `docker compose up -d` |
| DB | additive migrations usually need no rollback; destructive → plan 2-phase migration + Neon PITR |