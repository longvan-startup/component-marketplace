import { describe, expect, test } from 'bun:test'
import {
  createHttpAuthSource,
  createMockAuthSource,
  getAuthSource,
  ResetPasswordError,
  resolveApiMode,
} from './auth-source'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('mock auth source', () => {
  const source = createMockAuthSource()

  test('requestPasswordReset always returns the generic non-leaking response', async () => {
    const forKnown = await source.requestPasswordReset('known@test.local', 'https://x/reset')
    const forUnknown = await source.requestPasswordReset('nobody@test.local', 'https://x/reset')
    expect(forKnown).toEqual(forUnknown)
    expect(forKnown.status).toBe(true)
  })

  test('resetPassword succeeds for an ordinary token', async () => {
    expect(await source.resetPassword('any-token', 'longenoughpassword')).toEqual({ status: true })
  })

  test('resetPassword rejects the magic "expired"/"invalid" tokens with ResetPasswordError', async () => {
    await expect(source.resetPassword('expired', 'longenoughpassword')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    })
    await expect(source.resetPassword('invalid', 'longenoughpassword')).rejects.toBeInstanceOf(
      ResetPasswordError,
    )
  })

  test('resendVerificationEmail always returns the generic non-leaking response', async () => {
    const forKnown = await source.resendVerificationEmail('known@test.local', 'https://x/verify')
    const forUnknown = await source.resendVerificationEmail('nobody@test.local', 'https://x/verify')
    expect(forKnown).toEqual(forUnknown)
    expect(forKnown.status).toBe(true)
  })
})

describe('source selection', () => {
  test('API_MODE defaults to mock even for unknown values', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
    expect(resolveApiMode('')).toBe('mock')
    expect(resolveApiMode('nonsense' as string | undefined)).toBe('mock')
    expect(resolveApiMode('live')).toBe('live')
  })

  test('getAuthSource takes the mode explicitly (never reads env itself)', async () => {
    const mock = getAuthSource('mock')
    const result = await mock.requestPasswordReset('a@test.local', 'https://x/reset')
    expect(result.status).toBe(true) // mock source's canned response, not a real fetch
  })
})

describe('http auth source (real Better Auth wire shape)', () => {
  test('requestPasswordReset POSTs and parses the response', async () => {
    let seenBody: unknown
    const source = createHttpAuthSource({
      fetchImpl: async (_url, init) => {
        seenBody = JSON.parse(String(init?.body))
        return jsonResponse(200, { status: true, message: 'If this email exists…' })
      },
      publicApiUrl: 'https://api.example.test',
    })
    const result = await source.requestPasswordReset(
      'user@test.local',
      'https://web/reset-password',
    )
    expect(result.status).toBe(true)
    expect(seenBody).toEqual({
      email: 'user@test.local',
      redirectTo: 'https://web/reset-password',
    })
  })

  test('always targets /api/auth/* regardless of base convention (Better Auth is always mounted there, unlike the catalog router)', async () => {
    let seenUrl = ''
    const withExplicitOrigin = createHttpAuthSource({
      fetchImpl: async (url) => {
        seenUrl = String(url)
        return jsonResponse(200, { status: true })
      },
      publicApiUrl: 'http://127.0.0.1:4000', // Docker/local convention — bare origin, no /api
    })
    await withExplicitOrigin.requestPasswordReset('a@test.local', 'https://web/reset-password')
    expect(seenUrl).toBe('http://127.0.0.1:4000/api/auth/request-password-reset')

    const withSameOriginDefault = createHttpAuthSource({
      fetchImpl: async (url) => {
        seenUrl = String(url)
        return jsonResponse(200, { status: true })
      },
      // '' (not undefined) so this is deterministic regardless of ambient
      // process.env.NEXT_PUBLIC_API_URL — same-origin Vercel rewrite convention.
      publicApiUrl: '',
      runtime: 'browser',
    })
    await withSameOriginDefault.requestPasswordReset('a@test.local', 'https://web/reset-password')
    expect(seenUrl).toBe('/api/auth/request-password-reset') // NOT /api/api/auth/...
  })

  test('resetPassword success parses {status:true}', async () => {
    const source = createHttpAuthSource({
      fetchImpl: async () => jsonResponse(200, { status: true }),
      publicApiUrl: 'https://api.example.test',
    })
    expect(await source.resetPassword('tok', 'longenoughpassword')).toEqual({ status: true })
  })

  test('resetPassword maps a Better Auth INVALID_TOKEN error to ResetPasswordError', async () => {
    const source = createHttpAuthSource({
      fetchImpl: async () => jsonResponse(400, { message: 'Invalid token', code: 'INVALID_TOKEN' }),
      publicApiUrl: 'https://api.example.test',
    })
    await expect(source.resetPassword('bad-token', 'longenoughpassword')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      status: 400,
    })
  })

  test('resetPassword maps a Better Auth PASSWORD_TOO_SHORT error', async () => {
    const source = createHttpAuthSource({
      fetchImpl: async () =>
        jsonResponse(400, { message: 'Password too short', code: 'PASSWORD_TOO_SHORT' }),
      publicApiUrl: 'https://api.example.test',
    })
    await expect(source.resetPassword('tok', 'short')).rejects.toMatchObject({
      code: 'PASSWORD_TOO_SHORT',
    })
  })

  test('resendVerificationEmail POSTs to /api/auth/send-verification-email and parses {status:true}', async () => {
    let seenUrl = ''
    let seenBody: unknown
    const source = createHttpAuthSource({
      fetchImpl: async (url, init) => {
        seenUrl = String(url)
        seenBody = JSON.parse(String(init?.body))
        return jsonResponse(200, { status: true })
      },
      publicApiUrl: 'https://api.example.test',
    })
    const result = await source.resendVerificationEmail(
      'user@test.local',
      'https://web/verify-email?verified=1',
    )
    expect(result).toEqual({ status: true })
    expect(seenUrl).toBe('https://api.example.test/api/auth/send-verification-email')
    expect(seenBody).toEqual({
      email: 'user@test.local',
      callbackURL: 'https://web/verify-email?verified=1',
    })
  })
})
