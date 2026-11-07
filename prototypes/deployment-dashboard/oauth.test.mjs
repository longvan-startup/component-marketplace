import assert from 'node:assert/strict'
import test from 'node:test'
import { Auth } from '@auth/core'
import { authConfig, authSettings, hasAccess } from './lib/auth.mjs'

const fakeSecret = 'test-only-github-oauth-secret-at-least-32-characters'
const origin = 'http://localhost:3400'

function settings() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DASHBOARD_ORIGIN: origin,
    AUTH_SECRET: fakeSecret,
    AUTH_GITHUB_ID: 'test-github-app',
    AUTH_GITHUB_SECRET: 'test-github-secret',
    DASHBOARD_GITHUB_IDS: '199343172,92101206',
  })
  return authSettings()
}

function cookies(response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ')
}

async function githubFlow(id) {
  const config = authConfig(settings())
  const csrfResponse = await Auth(new Request(`${origin}/api/auth/csrf`), config)
  const csrf = await csrfResponse.json()
  const signin = await Auth(
    new Request(`${origin}/api/auth/signin/github`, {
      method: 'POST',
      headers: {
        cookie: cookies(csrfResponse),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: origin }),
    }),
    config,
  )
  assert.equal(signin.status, 302)
  const authorizeUrl = new URL(signin.headers.get('location'))
  assert.equal(authorizeUrl.origin, 'https://github.com')
  assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256')
  const state = authorizeUrl.searchParams.get('state')
  assert.ok(state)

  const oldFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const target = url instanceof Request ? url.url : String(url)
    if (target === 'https://github.com/login/oauth/access_token') {
      return new Response(
        JSON.stringify({
          access_token: 'test-fake-oauth-token',
          token_type: 'bearer',
          scope: 'read:user',
        }),
        {
          headers: { 'content-type': 'application/json' },
        },
      )
    }
    if (target === 'https://api.github.com/user') {
      return new Response(
        JSON.stringify({ id, login: 'test-user', name: 'Test', email: 'test@example.invalid' }),
        {
          headers: { 'content-type': 'application/json' },
        },
      )
    }
    throw new Error('Unexpected upstream')
  }
  try {
    const callback = await Auth(
      new Request(
        `${origin}/api/auth/callback/github?code=fake-code&state=${encodeURIComponent(state)}`,
        {
          headers: { cookie: [cookies(csrfResponse), cookies(signin)].filter(Boolean).join('; ') },
        },
      ),
      config,
    )
    return callback
  } finally {
    globalThis.fetch = oldFetch
  }
}

test('GitHub OAuth uses state and PKCE and only admits allowlisted GitHub IDs', async () => {
  const approved = await githubFlow(199343172)
  assert.equal(approved.status, 302)
  assert.equal(approved.headers.get('location'), origin)
  const approvedCookies = approved.headers.getSetCookie()
  assert.ok(
    approvedCookies.some(
      (value) => value.startsWith('authjs.session-token=') && value.includes('HttpOnly'),
    ),
  )
  assert.equal(await hasAccess({ headers: { cookie: cookies(approved) } }, authSettings()), true)
  assert.equal(approvedCookies.join(';').includes('test-fake-oauth-token'), false)

  const denied = await githubFlow(12345)
  assert.equal(denied.status, 302)
  assert.match(denied.headers.get('location'), /AccessDenied/)
  assert.equal(await hasAccess({ headers: { cookie: cookies(denied) } }, authSettings()), false)
})

test('Auth.js rejects OAuth callback without matching state cookie', async () => {
  const response = await Auth(
    new Request(`${origin}/api/auth/callback/github?code=fake-code&state=bad`),
    authConfig(settings()),
  )
  assert.equal(response.status, 302)
  assert.match(response.headers.get('location'), /error=/)
  assert.equal(await hasAccess({ headers: { cookie: cookies(response) } }, authSettings()), false)
})
