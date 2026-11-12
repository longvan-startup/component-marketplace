import { describe, expect, test } from 'bun:test'
import { AuthRequestError, createHttpAuthSource, createMockAuthSource } from './auth-source'

const USER = { id: 'u1', email: 'a@b.co', name: 'An', image: null, emailVerified: true }

/** Records every call and answers with one canned JSON response. */
function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { calls, fetchImpl }
}

function httpSource(status: number, body: unknown) {
  const stub = stubFetch(status, body)
  const source = createHttpAuthSource({
    fetchImpl: stub.fetchImpl,
    publicApiUrl: 'http://api.test',
    runtime: 'browser',
  })
  return { ...stub, source }
}

describe('http auth source — sign-in / sign-up / session', () => {
  test('signIn posts email + password to Better Auth and parses the user', async () => {
    const { calls, source } = httpSource(200, { redirect: false, token: 't', user: USER })
    const result = await source.signIn('a@b.co', 'secret-123')
    expect(calls[0]?.url).toBe('http://api.test/api/auth/sign-in/email')
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.credentials).toBe('include')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      email: 'a@b.co',
      password: 'secret-123',
    })
    expect(result.user.email).toBe('a@b.co')
  })

  test('signIn surfaces the Better Auth error code', async () => {
    const { source } = httpSource(401, {
      code: 'INVALID_EMAIL_OR_PASSWORD',
      message: 'Invalid email or password',
    })
    const error = await source.signIn('a@b.co', 'nope').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AuthRequestError)
    expect((error as AuthRequestError).status).toBe(401)
    expect((error as AuthRequestError).code).toBe('INVALID_EMAIL_OR_PASSWORD')
  })

  test('signUp sends name + callbackURL and accepts a null token', async () => {
    const { calls, source } = httpSource(200, {
      token: null,
      user: { ...USER, emailVerified: false },
    })
    const result = await source.signUp(
      { name: 'An', email: 'a@b.co', password: 'secret-123' },
      'http://web.test/verify-email',
    )
    expect(calls[0]?.url).toBe('http://api.test/api/auth/sign-up/email')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      name: 'An',
      email: 'a@b.co',
      password: 'secret-123',
      callbackURL: 'http://web.test/verify-email',
    })
    expect(result.token).toBeNull()
  })

  test('getSession sends the cookie and returns null when signed out', async () => {
    const { calls, source } = httpSource(200, null)
    expect(await source.getSession()).toBeNull()
    expect(calls[0]?.url).toBe('http://api.test/api/auth/get-session')
    expect(calls[0]?.init.credentials).toBe('include')
  })

  test('getSession parses a live session', async () => {
    const { source } = httpSource(200, {
      session: { id: 's1', userId: 'u1', expiresAt: '2026-12-01T00:00:00.000Z', token: 'x' },
      user: USER,
    })
    const session = await source.getSession()
    expect(session?.user.name).toBe('An')
  })

  test('signOut posts to sign-out', async () => {
    const { calls, source } = httpSource(200, { success: true })
    expect(await source.signOut()).toEqual({ success: true })
    expect(calls[0]?.url).toBe('http://api.test/api/auth/sign-out')
  })
})

describe('mock auth source — sign-in / sign-up / session', () => {
  test('rejects the sentinel password and stays signed out', async () => {
    const source = createMockAuthSource()
    const error = await source.signIn('a@b.co', 'wrong').catch((e: unknown) => e)
    expect((error as AuthRequestError).code).toBe('INVALID_EMAIL_OR_PASSWORD')
    expect((await source.signIn('a@b.co', 'ok')).user.email).toBe('a@b.co')
    expect(await source.getSession()).toBeNull()
  })

  test('signUp returns an unverified user without a token', async () => {
    const result = await createMockAuthSource().signUp(
      { name: 'An', email: 'a@b.co', password: 'secret-123' },
      'http://web.test/verify-email',
    )
    expect(result).toMatchObject({ token: null, user: { name: 'An', emailVerified: false } })
  })
})
