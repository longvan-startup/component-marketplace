# Deployment and release runbook

## Release policy

The production path is:

```text
Merge to main → required CI passes → prepare immutable artifacts → Ready to Release
                                                        ↓ owner confirms
                                      protected GitHub release workflow → Production
```

`CI` still owns lint, typecheck, tests, build and Docker runtime/migration smoke checks. `CD preparation` runs only after a successful `CI` push to `main`. It may publish the API image under its full commit SHA and create a Vercel production-target deployment with domains skipped. It never runs production migrations, assigns production domains, or deploys to a VPS.

The component registry source of truth is `apps/api/registry/<slug>/<version>/` in Git. The API build copies that tree beside the Docker bundle at `apps/api/dist/registry`; the Vercel API service includes `registry/**/*` in the `dist/index.js` function bundle and resolves it beside the function entrypoint. Test fixtures live under `apps/api/test/fixtures/registry` and are not part of the deployment bundle.

The root [`vercel.json`](../vercel.json) disables automatic Vercel Git deployments for every branch; a CLI-created staged deployment is the only Vercel candidate used for release. The API service is built by `@vercel/backends`, which typechecks with the project's TypeScript compiler API (`ts.sys`). TypeScript 7 no longer exports that API, so the deploy fails after `tsc` with `Cannot read properties of undefined (reading 'readFile')`. Keep `typescript` on 6.x until that builder accepts TypeScript 7. The same builder then loads `dist/index.js` as CommonJS at `/var/task/index.js`. The API build emits a CommonJS bundle for that file; an ESM `index.js` crashes at runtime with `Cannot use import statement outside a module`. Web and API share this one Vercel project and one release target (`vercel-services`). They must not be deployed as two separate Vercel projects.

The `Production release` workflow can be started only with GitHub `workflow_dispatch`. The dispatch binds a full SHA and staged Vercel deployment ID; before the job promotes, it rechecks CI readiness and fetches that exact deployment ID. It returns `409` if the SHA changed or the pinned deployment no longer belongs to the configured project, is `READY`, and contains the exact same SHA. It does not substitute another deployment merely because the candidate list changed. The workflow independently checks that the full SHA is still on `main`, that required CI passed for that SHA, and that the staged deployment belongs to the configured project, is `READY`, and contains the exact same SHA. It uses `GET /v2/deployments/{id}/aliases` to distinguish an already-promoted deployment from a staged deployment and, after promotion, waits until that exact deployment has aliases. It applies database migrations only after the protected `production` environment allows the job and only for a deployment that is not already live, then promotes the immutable deployment without rebuilding. A successful release for the same SHA is a no-op on re-dispatch; a shared concurrency group serializes production releases. A failed release can be retried only when the new dispatch is bound to the latest failed run ID; an older queued dispatch cannot turn a failed attempt into an automatic retry.

The release input is the oldest `READY` deployment for the latest CI-verified SHA from the deployments that Vercel returns; ties are broken by deployment ID. Alias assignment does not affect candidate ranking, so a Vercel alias-state update cannot switch the selected ID. The `CD preparation` staging job is serialized per commit SHA and reuses an existing ready staged deployment only when `GET /v2/deployments/{id}/aliases` confirms it has no assigned aliases. The deployment details `alias` field alone is not authoritative: it can be empty while a custom alias points at the deployment. Checking the alias endpoint prevents a promoted deployment from being mistaken for a fresh staging candidate.

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
4. Add repository variables `VERCEL_TEAM_ID` (`team_…`) and `VERCEL_PROJECT_ID` (`prj_…`). Set `VERCEL_PREPARATION_ENABLED=true` only after a CI-green main commit can be staged with an empty deployment-alias list from `GET /v2/deployments/{id}/aliases` and metadata containing the same full SHA.

### 2. Protected release workflow and Neon

1. Create the GitHub Environment named `production`; add Long and Văn as required reviewers. Keep branch restrictions limited to `main`.
2. Add environment variables `PRODUCTION_RELEASE_ENABLED=true`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` after confirming Vercel setup.
3. Add the environment secret `VERCEL_RELEASE_TOKEN`. Leave `PROD_DATABASE_URL` unset until the production database exists. While it is unset, the release workflow skips migrations and still promotes the staged Web + API deployment. When the secret is set, it must be the Neon production URL, never a local or test database, and a failed migration stops promotion.
4. Confirm a staged deployment exists before enabling the dashboard action. Confirm the first migration and the Neon backup/restore path only before setting `PROD_DATABASE_URL`.

GitHub documents environment protection and required reviewers at <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments>.

### 3. Optional VPS connection later

This MVP does not deploy to a VPS. To add that target later, first provision and secure a Linux host, set up TLS/reverse proxy and health monitoring, and use a least-privilege GHCR reader. The production image must be pinned by registry digest or full commit SHA; `deploy/vps/compose.yaml` has no mutable `latest` fallback. Add a protected release job and explicit owner approval before setting any VPS credential. Do not add SSH secrets to this repository for the current Vercel-only release target.

## Verification and rollback notes

- CI and the CD preparation build remain separate from promotion. Docker runtime smoke tests stay in `CI`.
- `workflow_dispatch` receives the expected SHA and Vercel deployment ID. When retrying a failure it also receives the failed run ID. The workflow validates the SHA and deployment against fresh GitHub and Vercel state and rejects duplicate or unconfirmed retries.
- Failed releases keep their GitHub Actions conclusion and Vercel deployment state visible. Retry only after inspecting the failed workflow logs and confirming whether the migration completed. An unset `PROD_DATABASE_URL` skips that step; the frontend promotion does not wait for a database connection.
- Vercel promotion uses the staged deployment and does not rebuild it. Vercel rollback remains an owner action from the Vercel deployment dashboard or CLI.
- If a database migration has applied but Vercel promotion fails, do not blindly rerun or roll back the database. Inspect the migration journal and apply a compatible follow-up or restore plan with the database owner.
