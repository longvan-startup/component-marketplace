import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { encode } from '@auth/core/jwt'
import {
  appConfiguration,
  dispatchRelease,
  getCiSnapshot,
  workflowState,
} from './lib/github-release.mjs'
import { getReleaseSnapshot, releaseConfiguration } from './lib/release.mjs'
import { handleRelease } from './lib/release-http.mjs'

const secret = 'test-only-encryption-secret-at-least-32-characters'
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const sha = 'a'.repeat(40)
const repo = 'longvan-startup/component-marketplace'

function env(overrides = {}) {
  return {
    NODE_ENV: 'test',
    DASHBOARD_ORIGIN: 'http://127.0.0.1:3400',
    AUTH_SECRET: secret,
    AUTH_GITHUB_ID: 'test-client-id',
    AUTH_GITHUB_SECRET: 'test-client-secret',
    DASHBOARD_GITHUB_IDS: '199343172,92101206',
    RELEASE_GITHUB_REPOSITORY: repo,
    GITHUB_APP_ID: '12345',
    GITHUB_APP_INSTALLATION_ID: '67890',
    GITHUB_APP_PRIVATE_KEY: privateKey,
    VERCEL_API_TOKEN: 'test-vercel-read-token',
    VERCEL_TEAM_ID: 'team_test',
    VERCEL_PROJECT_IDS: 'prj_test',
    RELEASE_VERCEL_PROJECT_ID: 'prj_test',
    PRODUCTION_WEB_URL: 'https://marketplace.example',
    PRODUCTION_API_URL: 'https://marketplace.example/api',
    RELEASE_PRODUCTION_ENABLED: 'true',
    ...overrides,
  }
}

async function cookieFor(id = '199343172') {
  const token = await encode({
    secret,
    salt: 'authjs.session-token',
    token: { githubId: id },
    maxAge: 3600,
  })
  return `authjs.session-token=${token}`
}

function response(body, status = 200) {
  return Response.json(body, { status })
}

test('release configuration requires an explicit enable flag and separate production URLs', () => {
  const configured = releaseConfiguration(env())
  assert.equal(configured.productionEnabled, true)
  assert.equal(configured.webUrl, 'https://marketplace.example')
  assert.equal(configured.apiUrl, 'https://marketplace.example/api')
  assert.equal(configured.missing.length, 0)

  const disabled = releaseConfiguration(env({ RELEASE_PRODUCTION_ENABLED: 'false' }))
  assert.equal(disabled.productionEnabled, false)
  assert.ok(disabled.missing.includes('release_disabled'))
  const unsafe = releaseConfiguration(env({ PRODUCTION_WEB_URL: 'http://localhost:3000' }))
  assert.equal(unsafe.webUrl, null)
  assert.ok(unsafe.missing.includes('production_urls'))
  const loopback = releaseConfiguration(
    env({ PRODUCTION_API_URL: 'https://127.0.0.1:4000/health' }),
  )
  assert.equal(loopback.apiUrl, null)
  assert.ok(loopback.missing.includes('production_urls'))
  assert.equal(appConfiguration(env({ GITHUB_APP_PRIVATE_KEY: 'invalid' })), null)
})

test('CI snapshot selects only successful main push runs and maps real workflow states', async () => {
  const fetchImpl = async () =>
    response({
      workflow_runs: [
        {
          head_branch: 'main',
          event: 'push',
          head_sha: 'b'.repeat(40),
          status: 'completed',
          conclusion: 'failure',
          created_at: '2026-11-07T12:00:00Z',
        },
        {
          head_branch: 'main',
          event: 'push',
          head_sha: sha,
          status: 'completed',
          conclusion: 'success',
          created_at: '2026-11-07T11:00:00Z',
          html_url: 'https://github.com/actions/runs/7',
          updated_at: '2026-11-07T11:05:00Z',
        },
        {
          head_branch: 'feature/ignored',
          event: 'pull_request',
          head_sha: 'c'.repeat(40),
          status: 'completed',
          conclusion: 'success',
          created_at: '2026-11-07T13:00:00Z',
        },
      ],
    })
  const result = await getCiSnapshot(env(), fetchImpl)
  assert.equal(result.latestMain.status, 'FAILED')
  assert.equal(result.latestMain.sha, 'b'.repeat(40))
  assert.equal(result.latestVerified.sha, sha)
  assert.equal(result.latestVerified.url, 'https://github.com/actions/runs/7')
  assert.equal(workflowState({ status: 'queued' }), 'QUEUED')
  assert.equal(workflowState({ status: 'in_progress' }), 'RUNNING')
  assert.equal(workflowState({ status: 'completed', conclusion: 'success' }), 'SUCCESS')
  assert.equal(workflowState({ status: 'completed', conclusion: 'failure' }), 'FAILED')
})

test('release snapshot is ready only for the exact CI SHA and a ready unpromoted Vercel deployment', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url)
    calls.push({ url: parsed, options })
    if (parsed.pathname === '/app/installations/67890/access_tokens')
      return response({ token: 'test-installation-token' })
    if (parsed.pathname.endsWith('/actions/workflows/ci.yml/runs'))
      return response({
        workflow_runs: [
          {
            head_branch: 'main',
            event: 'push',
            head_sha: sha,
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-11-07T10:00:00Z',
            updated_at: '2026-11-07T10:01:00Z',
            html_url: 'https://github.com/actions/runs/10',
          },
        ],
      })
    if (parsed.pathname === '/v9/projects/prj_test')
      return response({
        id: 'prj_test',
        targets: {
          production: {
            readyState: 'ERROR',
            deploymentId: 'dpl_current',
            url: 'marketplace.example',
          },
        },
      })
    if (parsed.pathname === '/v6/deployments')
      return response({
        deployments: [
          {
            uid: 'dpl_stage',
            state: 'READY',
            target: 'production',
            meta: { githubCommitSha: sha },
            url: 'staged.vercel.app',
            aliasAssigned: false,
            created: 1762500000000,
          },
          {
            uid: 'dpl_current',
            state: 'READY',
            target: 'production',
            meta: { githubCommitSha: 'd'.repeat(40) },
            url: 'marketplace.vercel.app',
            aliasAssigned: true,
            created: 1762400000000,
          },
        ],
      })
    if (parsed.pathname === '/v13/deployments/dpl_stage')
      return response({
        uid: 'dpl_stage',
        projectId: 'prj_test',
        readyState: 'READY',
        target: 'production',
        meta: { githubCommitSha: sha },
        url: 'staged.vercel.app',
        aliasAssigned: false,
        createdAt: 1762500000000,
      })
    if (parsed.pathname.endsWith('/actions/workflows/release.yml/runs'))
      return response({ workflow_runs: [] })
    throw new Error(`Unexpected request: ${parsed.pathname}`)
  }

  const result = await getReleaseSnapshot(env(), fetchImpl)
  assert.equal(result.readyToRelease, true)
  assert.equal(result.ci.latestVerified.sha, sha)
  assert.equal(result.stagedDeployment.id, 'dpl_stage')
  assert.equal(result.productionDeployment.commitSha, 'd'.repeat(40))
  assert.equal(result.productionState.status, 'ERROR')
  assert.equal(result.configuration.productionUrls.web, 'https://marketplace.example')
  assert.ok(
    calls.some(({ options }) => options.headers.authorization === 'Bearer test-installation-token'),
  )

  const unsafeDeployments = fetchImpl
  const notStaged = async (url, options = {}) => {
    const parsed = new URL(url)
    if (parsed.pathname === '/app/installations/67890/access_tokens')
      return response({ token: 'test-installation-token' })
    if (parsed.pathname.endsWith('/actions/workflows/ci.yml/runs'))
      return response({
        workflow_runs: [
          {
            head_branch: 'main',
            event: 'push',
            head_sha: sha,
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-11-07T10:00:00Z',
          },
        ],
      })
    if (parsed.pathname === '/v9/projects/prj_test')
      return response({
        id: 'prj_test',
        targets: { production: { readyState: 'READY', url: 'marketplace.example' } },
      })
    if (parsed.pathname === '/v6/deployments')
      return response({
        deployments: [
          {
            uid: 'dpl_stage',
            state: 'READY',
            target: 'production',
            meta: { githubCommitSha: sha },
            url: 'staged.vercel.app',
            aliasAssigned: true,
            created: 1762500000000,
          },
        ],
      })
    if (parsed.pathname.endsWith('/actions/workflows/release.yml/runs'))
      return response({ workflow_runs: [] })
    return unsafeDeployments(url, options)
  }
  const alreadyPromoted = await getReleaseSnapshot(env(), notStaged)
  assert.equal(alreadyPromoted.stagedDeployment, null)
  assert.equal(alreadyPromoted.readyToRelease, false)
})

test('release snapshot displays a failed GitHub Actions run as failed and allows a deliberate retry', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url)
    if (parsed.pathname === '/app/installations/67890/access_tokens')
      return response({ token: 'test-installation-token' })
    if (parsed.pathname.endsWith('/actions/workflows/ci.yml/runs'))
      return response({
        workflow_runs: [
          {
            head_branch: 'main',
            event: 'push',
            head_sha: sha,
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-11-07T10:00:00Z',
          },
        ],
      })
    if (parsed.pathname === '/v9/projects/prj_test')
      return response({
        id: 'prj_test',
        targets: { production: { readyState: 'READY', url: 'marketplace.example' } },
      })
    if (parsed.pathname === '/v6/deployments')
      return response({
        deployments: [
          {
            uid: 'dpl_stage',
            state: 'READY',
            target: 'production',
            meta: { githubCommitSha: sha },
            url: 'staged.vercel.app',
            aliasAssigned: false,
            created: 1762500000000,
          },
        ],
      })
    if (parsed.pathname === '/v13/deployments/dpl_stage')
      return response({
        uid: 'dpl_stage',
        projectId: 'prj_test',
        readyState: 'READY',
        target: 'production',
        meta: { githubCommitSha: sha },
        url: 'staged.vercel.app',
        aliasAssigned: false,
      })
    if (parsed.pathname.endsWith('/actions/workflows/release.yml/runs'))
      return response({
        workflow_runs: [
          {
            id: 22,
            status: 'completed',
            conclusion: 'failure',
            display_title: `Production release - vercel-services - ${sha}`,
            html_url: 'https://github.com/actions/runs/22',
          },
        ],
      })
    throw new Error(`Unexpected request: ${parsed.pathname}`)
  }
  const result = await getReleaseSnapshot(env(), fetchImpl)
  assert.equal(result.releaseRun.status, 'FAILED')
  assert.equal(result.releaseRun.url, 'https://github.com/actions/runs/22')
  assert.equal(result.readyToRelease, true)
})

test('workflow dispatch pins the selected staged deployment and never accepts arbitrary targets', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url)
    calls.push({ parsed, options })
    if (parsed.pathname === '/app/installations/67890/access_tokens')
      return response({ token: 'test-installation-token' })
    if (parsed.pathname.endsWith('/actions/workflows/release.yml/dispatches'))
      return new Response(null, { status: 204 })
    throw new Error(`Unexpected request: ${parsed.pathname}`)
  }
  await assert.rejects(
    dispatchRelease(env(), { target: 'admin', sha, deploymentId: 'dpl_stage' }, fetchImpl),
    /INVALID_RELEASE_REQUEST/,
  )
  const result = await dispatchRelease(
    env(),
    { target: 'vercel-services', sha, deploymentId: 'dpl_stage' },
    fetchImpl,
  )
  assert.equal(result.status, 'QUEUED')
  assert.equal(result.sha, sha)
  const request = calls.find(({ parsed }) => parsed.pathname.endsWith('/dispatches'))
  assert.equal(request.options.headers.authorization, 'Bearer test-installation-token')
  assert.deepEqual(JSON.parse(request.options.body), {
    ref: 'main',
    inputs: { target: 'vercel-services', target_sha: sha, vercel_deployment_id: 'dpl_stage' },
    return_run_details: true,
  })
})

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(value) {
      this.body = JSON.parse(value)
    },
  }
}

test('release POST requires an allowlisted session, same-origin request, CSRF cookie, and confirmation', async () => {
  Object.assign(process.env, env())
  const authCookie = await cookieFor()
  const denied = mockRes()
  await handleRelease(
    { method: 'POST', url: '/api/release', headers: { cookie: await cookieFor('777') } },
    denied,
  )
  assert.equal(denied.statusCode, 401)

  const csrfResponse = mockRes()
  await handleRelease(
    { method: 'GET', url: '/api/release/csrf', headers: { cookie: authCookie } },
    csrfResponse,
  )
  assert.equal(csrfResponse.statusCode, 200)
  const token = csrfResponse.body.csrfToken
  const csrfCookie = csrfResponse.headers['set-cookie'].split(';', 1)[0]
  const baseHeaders = {
    cookie: `${authCookie}; ${csrfCookie}`,
    origin: 'http://127.0.0.1:3400',
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
    'x-csrf-token': token,
  }
  const foreignOrigin = mockRes()
  await handleRelease(
    {
      method: 'POST',
      url: '/api/release',
      headers: { ...baseHeaders, origin: 'https://attacker.example' },
      body: { confirmed: true },
    },
    foreignOrigin,
  )
  assert.equal(foreignOrigin.statusCode, 403)
  const badCsrf = mockRes()
  await handleRelease(
    {
      method: 'POST',
      url: '/api/release',
      headers: { ...baseHeaders, 'x-csrf-token': 'x'.repeat(43) },
      body: { confirmed: true },
    },
    badCsrf,
  )
  assert.equal(badCsrf.statusCode, 403)
  const notConfirmed = mockRes()
  await handleRelease(
    { method: 'POST', url: '/api/release', headers: baseHeaders, body: { confirmed: false } },
    notConfirmed,
  )
  assert.equal(notConfirmed.statusCode, 400)

  let starts = 0
  const accepted = mockRes()
  await handleRelease(
    { method: 'POST', url: '/api/release', headers: baseHeaders, body: { confirmed: true } },
    accepted,
    {
      startRelease: async () => {
        starts++
        return { started: true, release: { status: 'QUEUED', id: 9 } }
      },
    },
  )
  assert.equal(accepted.statusCode, 202)
  assert.equal(accepted.body.release.status, 'QUEUED')
  assert.equal(starts, 1)
})
