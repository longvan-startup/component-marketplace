# Deployment and release runbook

## Release policy

The production path is:

```text
Merge to main → required CI passes → prepare immutable artifacts → Ready to Release
                                                        ↓ owner confirms
                                      protected GitHub release workflow → Production
```

`CI` still owns lint, typecheck, tests, build and Docker runtime/migration smoke checks. `CD preparation` runs only after a successful `CI` push to `main`. It may publish the API image under its full commit SHA and create a Vercel production-target deployment with domains skipped. It never runs production migrations, assigns production domains, or deploys to a VPS.

The root [`vercel.json`](../vercel.json) disables automatic Vercel Git deployments for every branch; a CLI-created staged deployment is the only Vercel candidate used for release. The API service is built by `@vercel/backends`, which typechecks with the project's TypeScript compiler API (`ts.sys`). TypeScript 7 no longer exports that API, so the deploy fails after `tsc` with `Cannot read properties of undefined (reading 'readFile')`. Keep `typescript` on 6.x until that builder accepts TypeScript 7. The same builder then loads `dist/index.js` as CommonJS at `/var/task/index.js`. The API build emits a CommonJS bundle for that file; an ESM `index.js` crashes at runtime with `Cannot use import statement outside a module`. Web and API share this one Vercel project and one release target (`vercel-services`). They must not be deployed as two separate projects from the dashboard. The dashboard's own [`vercel.json`](../prototypes/deployment-dashboard/vercel.json) also disables automatic Git deployments for every branch.

The `Production release` workflow can be started only with GitHub `workflow_dispatch`. The dashboard confirmation binds the displayed full SHA and staged Vercel deployment ID; before dispatch, the server recomputes readiness and returns `409` if the candidate changed. The workflow independently checks that the full SHA is still on `main`, that required CI passed for that SHA, and that the staged deployment belongs to the configured project, is `READY`, and contains the exact same SHA. It applies database migrations only after the protected `production` environment allows the job, then promotes that immutable deployment without rebuilding. A successful release for the same SHA is a no-op on re-dispatch; a shared concurrency group serializes production releases. A failed release can be retried only when the dashboard confirmation is bound to the latest failed run ID; an older queued dispatch cannot turn a failed attempt into an automatic retry.

Missing configuration keeps the Control Room action disabled. The current code does not create a simulated deployment or fall back to local URLs for production. The API and dashboard endpoints read GitHub Actions/Vercel state server-side; no deployment credential is sent to the browser. The dashboard also reads the five most recently updated PRs as separate read-only status; PR activity does not change release readiness, which still depends on successful CI for a commit on `main`. The active Vercel production deployment's commit is shown separately from the latest verified CI commit. Legacy localStorage records are labeled as old user-entered records and are not release status.

## Release targets

| Target | Release boundary | Current behavior |
| --- | --- | --- |
| Web + Backend / API | One Vercel project and one staged deployment | Prepared after CI if Vercel Actions configuration exists; explicit promotion only. |
| Admin | No application exists in `main` | Planned / Not configured; no fake server or deployment. |
| VPS API | Separate host and deployment target | No automatic SSH deployment in this MVP. The GHCR full-SHA image may be prepared, but a VPS release path needs owner-approved host credentials and a later implementation. |
| Neon database | Migration required by a release | `drizzle-kit migrate` runs only within the approved production release workflow. It never runs after merge by `CD preparation`. |

## Owner setup checklist

Do not set the enable flags until all required steps below are complete and a staging build has been verified. These are remote owner settings; this code change does not modify GitHub, Vercel, or Neon settings.

### 1. Vercel staged deployment

1. Confirm the Marketplace Vercel Services project points at `longvan-startup/component-marketplace`, with the repository root as its project root and the current `vercel.json` services configuration.
2. Disable automatic deployments for every branch in the Vercel project's Git settings. The repository config sets `git.deploymentEnabled` to `false`; verify the Vercel project settings enforce it before enabling release. This also disables automatic PR previews. Vercel documents both this Git setting and staged production deployments via `--prod --skip-domain` followed by `vercel promote`:
   - <https://vercel.com/docs/project-configuration/git-configuration>
   - <https://vercel.com/docs/cli/deploying-from-cli>
3. Create separate Vercel tokens for the Marketplace project if the account supports that scope: `VERCEL_PREPARATION_TOKEN` as a repository secret for staging and `VERCEL_RELEASE_TOKEN` as a `production` environment secret for promotion. Keep both server-side and limited to the Marketplace team/project. They are used in different workflows so either can be revoked independently.
4. Add repository variables `VERCEL_TEAM_ID` (`team_…`) and `VERCEL_PROJECT_ID` (`prj_…`). Set `VERCEL_PREPARATION_ENABLED=true` only after a CI-green main commit can be staged with `aliasAssigned=false` and its deployment metadata contains the same full SHA.
5. Record the intended public Web URL and API health URL in the Control Room's server-side Vercel environment as `PRODUCTION_WEB_URL` and `PRODUCTION_API_URL`. Confirm the API path against the Vercel Services rewrites before enabling release.

### 2. Protected release workflow and Neon

1. Create the GitHub Environment named `production`; add Long and Văn as required reviewers. Keep branch restrictions limited to `main`.
2. Add environment variables `PRODUCTION_RELEASE_ENABLED=true`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` after confirming Vercel setup.
3. Add environment secrets `VERCEL_RELEASE_TOKEN` and `PROD_DATABASE_URL`. The database URL must point at the intended Neon production database, never a local/test database.
4. Confirm the first release can run migrations successfully and the Neon project's backup/restore recovery path is known before enabling the dashboard action.

GitHub documents environment protection and required reviewers at <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments>.

### 3. Control Room credentials

1. Install a GitHub App only on `longvan-startup/component-marketplace`, with `Actions: read and write`, `Contents: read`, and `Pull requests: read`. The last permission is read-only and is used for the recent PR list. Approve the permission update on the existing installation. If that permission is not available yet, the dashboard attempts a public unauthenticated read; this fallback is suitable only while the repository remains public and may have a lower rate limit. Keep the allowlist in `DASHBOARD_GITHUB_IDS` limited to Long and Văn.
2. Add `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY` to the Control Room Vercel project environment. The app private key remains server-side.
3. Add a read-only Vercel API token and the project/team IDs to the Control Room environment: `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_IDS`, `RELEASE_VERCEL_PROJECT_ID`.
4. Set `RELEASE_GITHUB_REPOSITORY=longvan-startup/component-marketplace` and the production URLs. Keep `RELEASE_PRODUCTION_ENABLED=false` until the GitHub App can read CI, dispatch the workflow, and the protected environment and required secrets have been checked.
5. Set `RELEASE_PRODUCTION_ENABLED=true` only after a non-production/focused verification confirms that a release action remains disabled when any required target/configuration is missing. No production deployment should be used as an acceptance test.

### 4. Optional VPS connection later

This MVP does not deploy to a VPS. To add that target later, first provision and secure a Linux host, set up TLS/reverse proxy and health monitoring, and use a least-privilege GHCR reader. The production image must be pinned by registry digest or full commit SHA; `deploy/vps/compose.yaml` has no mutable `latest` fallback. Add a protected release job and explicit owner approval before setting any VPS credential. Do not add SSH secrets to this repository for the current Vercel-only release target.

## Local links and dashboard history

The Control Room opens Web at `http://localhost:3000` and API at `http://localhost:4000/health` by default. Long and Văn can save different loopback URLs in their own browsers. Only HTTP(S) loopback URLs are accepted; the dashboard never probes them. Admin has no local URL until an admin app exists.

Old `component-marketplace-control-room:deployment-history:v1` localStorage data remains visible under **Lịch sử cũ** for reference. Those user-entered PASS/FAIL records are not authoritative deployment or CI status.

## Verification and rollback notes

- CI and the CD preparation build remain separate from promotion. Docker runtime smoke tests stay in `CI`.
- `workflow_dispatch` receives the expected SHA and Vercel deployment ID from the confirmation. When retrying a failure it also receives the failed run ID. The server checks the expected candidate and failed run against fresh GitHub/Vercel state; the workflow independently validates the SHA and deployment and rejects duplicate or unconfirmed retries.
- Failed releases keep their GitHub Actions conclusion and Vercel deployment state visible. Retry only after inspecting the failed workflow logs and confirming whether the migration completed.
- Vercel promotion uses the staged deployment and does not rebuild it. Vercel rollback remains an owner action from the Vercel deployment dashboard or CLI.
- If a database migration has applied but Vercel promotion fails, do not blindly rerun or roll back the database. Inspect the migration journal and apply a compatible follow-up or restore plan with the database owner.
