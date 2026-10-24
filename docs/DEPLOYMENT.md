# Deployment & CD — current state and activation runbook

Source of truth for CDN/CD. Status verified with real commands (latest check:
2026-10-23). Every change after this date must update the verified-state table.

## Verified state (2026-10-23)

| Item | Status | How verified |
|---|---|---|
| CI (`ci.yml`) | green on main (lint+boundary+typecheck+test+build+docker isolation+DB migration smoke) | `gh run list` |
| CD workflow (`cd.yml`) | **exists** (this PR) — publishes api image to GHCR; production steps gated by repo secrets | `ls .github/workflows/` |
| GHCR publish | ready to run — uses built-in `GITHUB_TOKEN`, runs automatically after CI-green main push | workflow source |
| Repo secrets | to be created by owner when activating each layer | `gh api repos/.../actions/secrets` |
| Web deploy target | **Vercel Git Integration** (owner decision 2026-10-23) — no deploy tokens in repo | decision |
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

## 1. Web — Vercel Git Integration (no secrets in GitHub)

Manual one-time setup (Vercel dashboard):

1. vірáp://vercel.com → Add New… → Project → **Import** the
   `longvan-startup/component-marketplace` GitHub repo.
2. Project Settings → **General → Root Directory** = `apps/web`
   (framework auto-detects Next.js).
3. Environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = public URL of the API (e.g. `https://api.<domain>`)
     — set for **Production** + **Preview**.
4. Build overrides unnecessary; Vercel handles `bun`-based monorepo install if
   Root Directory is set. Verify the first deploy log shows `next build`.
5. Done: every PR gets a **preview** deployment comment; pushes to `main`
   produce production deploys (rollback = Vercel Instant Rollback).

Nothing in this repo calls Vercel; no deploy secrets exist by design.

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