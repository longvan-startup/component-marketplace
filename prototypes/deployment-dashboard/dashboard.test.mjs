import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'
import { encode } from '@auth/core/jwt'
import { handleApi } from './lib/http.mjs'

const secret = 'test-only-encryption-secret-at-least-32-characters'
const originalFetch = globalThis.fetch
function reset() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DASHBOARD_ORIGIN: 'http://127.0.0.1:3400',
    AUTH_SECRET: secret,
    AUTH_GITHUB_ID: 'test-client-id',
    AUTH_GITHUB_SECRET: 'test-client-secret',
    DASHBOARD_GITHUB_IDS: '199343172,92101206',
    VERCEL_TEAM_ID: 'team_test',
    VERCEL_PROJECT_IDS: 'prj_123',
    VERCEL_API_TOKEN: 'test-upstream-key',
  })
  globalThis.fetch = originalFetch
}
async function cookieFor(id, maxAge = 3600) {
  const value = await encode({
    secret,
    salt: 'authjs.session-token',
    token: { githubId: id },
    maxAge,
  })
  return `authjs.session-token=${value}`
}
async function request(action, { cookie = '', path = '/', method = 'GET' } = {}) {
  const req = { method, url: path, headers: { cookie } }
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(value) {
      this.body = JSON.parse(value)
    },
  }
  await handleApi(req, res, action)
  return res
}
test('refuses missing config, guests, tampered or disallowed sessions', async () => {
  reset()
  const allowed = await cookieFor('199343172')
  assert.equal((await request('services')).statusCode, 401)
  assert.equal(
    (await request('services', { cookie: 'authjs.session-token=not-valid' })).statusCode,
    401,
  )
  assert.equal((await request('services', { cookie: await cookieFor('12345') })).statusCode, 401)
  assert.equal(
    (await request('services', { cookie: await cookieFor('199343172', -60) })).statusCode,
    401,
  )
  delete process.env.AUTH_SECRET
  assert.equal((await request('services', { cookie: allowed })).statusCode, 503)
  reset()
  delete process.env.DASHBOARD_GITHUB_IDS
  assert.equal((await request('services', { cookie: allowed })).statusCode, 503)
})
test('revoking a GitHub ID blocks an existing session', async () => {
  reset()
  const cookie = await cookieFor('92101206')
  process.env.DASHBOARD_GITHUB_IDS = '199343172'
  assert.equal((await request('services', { cookie })).statusCode, 401)
})

test('production requires HTTPS and uses the secure Auth.js cookie', async () => {
  reset()
  process.env.NODE_ENV = 'production'
  const localCookie = await cookieFor('199343172')
  assert.equal((await request('services', { cookie: localCookie })).statusCode, 503)
  process.env.DASHBOARD_ORIGIN = 'https://control.example.test'
  const secureToken = await encode({
    secret,
    salt: '__Secure-authjs.session-token',
    token: { githubId: '199343172' },
    maxAge: 3600,
  })
  delete process.env.VERCEL_API_TOKEN
  const result = await request('services', {
    cookie: `__Secure-authjs.session-token=${secureToken}`,
  })
  assert.equal(result.statusCode, 503)
  assert.equal(result.body.error, 'NOT_CONFIGURED')
  assert.equal((await request('services', { cookie: localCookie })).statusCode, 401)
})
test('missing Vercel config fails closed', async () => {
  reset()
  const cookie = await cookieFor('199343172')
  for (const value of ['', 'invalid', 'prj_123,other']) {
    process.env.VERCEL_PROJECT_IDS = value
    assert.equal((await request('services', { cookie })).statusCode, 503)
  }
  assert.equal((await request('services', { cookie, method: 'POST' })).statusCode, 405)
})
test('service adapter uses fixed upstream and strips private fields', async () => {
  reset()
  const cookie = await cookieFor('199343172')
  globalThis.fetch = async (url, options) => {
    assert.equal(url.href, 'https://api.vercel.com/v9/projects/prj_123?teamId=team_test')
    assert.equal(options.headers.authorization, 'Bearer test-upstream-key')
    assert.equal(options.redirect, 'error')
    return Response.json({
      id: 'prj_123',
      name: 'Website',
      targets: { production: { readyState: 'READY' } },
      secret: 'private-value',
    })
  }
  try {
    const result = await request('services', { cookie })
    assert.equal(result.statusCode, 200)
    assert.equal(result.headers['cache-control'], 'no-store, max-age=0')
    assert.deepEqual(result.body.items, [
      { id: 'prj_123', name: 'Website', description: 'Vercel project', status: 'READY' },
    ])
    assert.equal(JSON.stringify(result.body).includes('private-value'), false)
  } finally {
    reset()
  }
})
test('deployment adapter blocks non-allowlisted projects and strips private fields', async () => {
  reset()
  const cookie = await cookieFor('92101206')
  globalThis.fetch = async (url) => {
    assert.equal(
      url.href,
      'https://api.vercel.com/v6/deployments?teamId=team_test&projectId=prj_123&limit=50',
    )
    return Response.json({
      deployments: [
        { uid: 'dpl_1', state: 'READY', created: 1767225600000, secret: 'private-value' },
      ],
    })
  }
  try {
    const result = await request('deployments', { cookie, path: '/api/deployments?id=prj_123' })
    assert.deepEqual(result.body.items, [
      { id: 'dpl_1', status: 'READY', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    assert.equal(
      (await request('deployments', { cookie, path: '/api/deployments?id=prj_other' })).statusCode,
      400,
    )
    assert.equal(
      (await request('deployments', { cookie, path: '/api/deployments?id=..%2Fprivate' }))
        .statusCode,
      400,
    )
  } finally {
    reset()
  }
})
test('upstream errors, invalid payloads and oversized bodies return generic errors', async () => {
  reset()
  const cookie = await cookieFor('199343172')
  try {
    globalThis.fetch = async () => new Response('secret upstream details', { status: 401 })
    const failure = await request('services', { cookie })
    assert.equal(failure.statusCode, 502)
    assert.equal(JSON.stringify(failure.body).includes('secret'), false)
    globalThis.fetch = async () => new Response('{not-json')
    assert.equal((await request('services', { cookie })).body.error, 'UPSTREAM_RESPONSE')
    globalThis.fetch = async () => new Response(JSON.stringify({ items: 'unexpected', total: 1 }))
    assert.equal((await request('services', { cookie })).statusCode, 502)
    globalThis.fetch = async () => new Response('x'.repeat(1_000_001))
    assert.equal((await request('services', { cookie })).body.error, 'UPSTREAM_RESPONSE')
  } finally {
    reset()
  }
})
test('local HTTP server serves login and denies anonymous API access', async () => {
  reset()
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start')), 5000)
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.stdout.once('data', (chunk) => {
        clearTimeout(timer)
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)
        if (match) resolve(match[0])
        else reject(new Error('Invalid server startup'))
      })
    })
    const page = await fetch(base)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Control Room/)
    assert.equal((await fetch(`${base}/api/services`)).status, 401)
    const signin = await fetch(`${base}/api/auth/signin`)
    assert.equal(signin.status, 200)
    assert.match(await signin.text(), /GitHub/)
    const csrfResponse = await fetch(`${base}/api/auth/csrf`)
    const { csrfToken } = await csrfResponse.json()
    const csrfCookie = csrfResponse.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; ')
    const oauth = await fetch(`${base}/api/auth/signin/github`, {
      method: 'POST',
      headers: { cookie: csrfCookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken }),
      redirect: 'manual',
    })
    assert.equal(oauth.status, 302)
    const destination = new URL(oauth.headers.get('location'))
    assert.equal(destination.origin, 'https://github.com')
    assert.equal(destination.searchParams.get('code_challenge_method'), 'S256')
    assert.ok(oauth.headers.getSetCookie().some((value) => value.includes('HttpOnly')))
    assert.equal((await fetch(`${base}/.env`)).status, 404)
  } finally {
    child.kill()
  }
})
