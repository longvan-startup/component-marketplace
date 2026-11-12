import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

const listApiFiles = async (directory = './api') => {
  const entries = await readdir(new URL(directory, import.meta.url), { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = `${directory}/${entry.name}`
      return entry.isDirectory() ? listApiFiles(path) : [path]
    }),
  )

  return nested.flat()
}

test('dashboard stays within Vercel Hobby limit and maps nested GitHub OAuth routes', async () => {
  const functionExtensions = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx'])
  const apiFiles = (await listApiFiles()).filter((path) =>
    functionExtensions.has(path.slice(path.lastIndexOf('.'))),
  )
  const authFiles = apiFiles.filter((path) => path.startsWith('./api/auth/')).sort()

  assert.ok(apiFiles.length <= 12, `found ${apiFiles.length} Vercel functions; Hobby limit is 12`)
  assert.deepEqual(authFiles, [
    './api/auth/[...auth].mjs',
    './api/auth/callback/github.mjs',
    './api/auth/signin/github.mjs',
  ])
})

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
  assert.match(release, /retry_failed_run_id:/)
  assert.match(release, /A previous release run exists/)
  assert.match(release, /already_released/)
  assert.match(release, /vercel promote/)
  assert.match(release, /cancel-in-progress: false/)
  assert.match(release, /already_released/)
  assert.match(release, /completed.*success/s)
  assert.match(release, /db:migrate/)
  assert.match(release, /Skipping production migrations so the frontend release can continue/)
  assert.match(release, /steps\.release_config\.outputs\.migrate == 'true'/)
  assert.doesNotMatch(release, /PROD_DATABASE_URL is required/)
  assert.doesNotMatch(release, /cmp-api:latest|:latest/)

  const actionRefs = [...release.matchAll(/^\s+uses:\s+[^@\s]+@([^\s]+)/gm)].map(
    (match) => match[1],
  )
  assert.ok(actionRefs.length > 0)
  assert.ok(actionRefs.every((ref) => /^[a-f0-9]{40}$/.test(ref)))

  const releaseJobEnv = release.slice(release.indexOf('  release:'), release.indexOf('    steps:'))
  assert.doesNotMatch(releaseJobEnv, /secrets\.(?:VERCEL_RELEASE_TOKEN|PROD_DATABASE_URL)/)
  assert.match(
    release,
    /Apply database migrations after release approval[\s\S]*?DATABASE_URL: \$\{\{ secrets\.PROD_DATABASE_URL \}\}/,
  )
  assert.equal((release.match(/secrets\.PROD_DATABASE_URL/g) || []).length, 2)
  assert.equal((release.match(/secrets\.VERCEL_RELEASE_TOKEN/g) || []).length, 4)

  const cliInstallStart = release.indexOf('- name: Install pinned Vercel CLI')
  const promoteStart = release.indexOf('- name: Promote Vercel deployment without rebuilding')
  const promoteEnd = release.indexOf('\n', release.indexOf('run: vercel promote', promoteStart))
  const cliInstallStep = release.slice(cliInstallStart, promoteStart)
  const promoteStep = release.slice(promoteStart, promoteEnd)
  assert.ok(cliInstallStart >= 0 && promoteStart > cliInstallStart)
  assert.doesNotMatch(cliInstallStep, /VERCEL_TOKEN|VERCEL_RELEASE_TOKEN/)
  assert.match(promoteStep, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_RELEASE_TOKEN \}\}/)
})

test('both Vercel projects disable automatic Git deployments for every branch', async () => {
  const marketplace = JSON.parse(await read('../../vercel.json'))
  const dashboard = JSON.parse(await read('./vercel.json'))
  assert.equal(marketplace.git.deploymentEnabled, false)
  assert.equal(dashboard.git.deploymentEnabled, false)
})
