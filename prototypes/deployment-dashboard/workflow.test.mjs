import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('main CI stays intact while CD preparation cannot migrate or promote production', async () => {
  const ci = await read('../../.github/workflows/ci.yml')
  const cd = await read('../../.github/workflows/cd.yml')
  assert.match(ci, /Docker runtime smoke/)
  assert.match(ci, /compose\.verify\.yaml/)
  assert.match(cd, /workflow_run:/)
  assert.doesNotMatch(cd, /workflow_dispatch:/)
  assert.doesNotMatch(cd, /db:migrate|PROD_DATABASE_URL|deploy-vps|ssh /i)
  assert.match(cd, /cmp-api:sha-\$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
  assert.match(cd, /--prod --skip-domain/)
  assert.doesNotMatch(cd, /vercel promote/)
})

test('production release is manual, protected, immutable, verified and serialized', async () => {
  const release = await read('../../.github/workflows/release.yml')
  assert.match(release, /workflow_dispatch:/)
  assert.match(release, /environment: production/)
  assert.match(release, /PRODUCTION_RELEASE_ENABLED/)
  assert.match(release, /git merge-base --is-ancestor/)
  assert.match(release, /actions\/workflows\/ci\.yml\/runs/)
  assert.match(release, /ci\.yml\/runs" --method GET -f branch=main -f event=push -f head_sha=/)
  assert.match(release, /head_sha/)
  assert.match(release, /\.head_sha == \$sha/)
  assert.match(
    release,
    /release\.yml\/runs" --method GET -f branch=main -f event=workflow_dispatch/,
  )
  assert.match(release, /vercel_deployment_id:/)
  assert.match(release, /vercel promote/)
  assert.match(release, /cancel-in-progress: false/)
  assert.match(release, /already_released/)
  assert.match(release, /db:migrate/)
  assert.doesNotMatch(release, /cmp-api:latest|:latest/)
})

test('both Vercel projects disable automatic Git deployments for every branch', async () => {
  const marketplace = JSON.parse(await read('../../vercel.json'))
  const dashboard = JSON.parse(await read('./vercel.json'))
  assert.equal(marketplace.git.deploymentEnabled, false)
  assert.equal(dashboard.git.deploymentEnabled, false)
})
