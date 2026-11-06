import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { ApiClientError, apiFetchJson, apiMutateJson, resolveApiBaseUrl } from './api-client'

describe('resolveApiBaseUrl — per-runtime base URL config', () => {
  const SAVED: Record<string, string | undefined> = {}

  beforeAll(() => {
    SAVED.pub = process.env.NEXT_PUBLIC_API_URL
    SAVED.internal = process.env.API_URL_INTERNAL
    process.env.NEXT_PUBLIC_API_URL = 'https://public.example.test'
    process.env.API_URL_INTERNAL = 'http://api:4000'
  })

  afterAll(() => {
    // Assigning `undefined` to `process.env.X` stringifies it to "undefined"
    // instead of unsetting it — delete when there was nothing to restore, so
    // later test files don't see a polluted literal "undefined" string.
    if (SAVED.pub === undefined) delete process.env.NEXT_PUBLIC_API_URL
    else process.env.NEXT_PUBLIC_API_URL = SAVED.pub
    if (SAVED.internal === undefined) delete process.env.API_URL_INTERNAL
    else process.env.API_URL_INTERNAL = SAVED.internal
  })

  test('server runtime prefers API_URL_INTERNAL (Docker network alias)', () => {
    expect(resolveApiBaseUrl('server')).toBe('http://api:4000')
  })

  test('server runtime falls back to the public URL when no internal var set', () => {
    expect(
      resolveApiBaseUrl('server', {
        publicApiUrl: 'https://public.example.test',
        internalApiUrl: undefined,
      }),
    ).toBe('https://public.example.test')
  })

  test('browser runtime always uses the public URL', () => {
    expect(resolveApiBaseUrl('browser')).toBe('https://public.example.test')
  })

  test('missing config falls back to the same-origin /api path (Vercel services rewrite)', () => {
    expect(
      resolveApiBaseUrl('browser', { publicApiUrl: undefined, internalApiUrl: undefined }),
    ).toBe('/api')
    expect(
      resolveApiBaseUrl('server', { publicApiUrl: undefined, internalApiUrl: undefined }),
    ).toBe('/api')
  })
})

describe('apiFetchJson', () => {
  test('happy path returns typed JSON from the resolved base', async () => {
    let requestedUrl = ''
    const result = await apiFetchJson<{ hello: string }>('/health', {
      fetchImpl: async (url) => {
        requestedUrl = String(url)
        return new Response(JSON.stringify({ hello: 'world' }), { status: 200 })
      },
      publicApiUrl: 'https://public.example.test',
      internalApiUrl: 'http://api:4000',
      runtime: 'server',
    })
    expect(result.hello).toBe('world')
    expect(requestedUrl).toBe('http://api:4000/health')
  })

  test('non-2xx becomes ApiClientError with status + path', async () => {
    try {
      await apiFetchJson('/components', {
        fetchImpl: async () =>
          new Response('{}', { status: 503, statusText: 'Service Unavailable' }),
        publicApiUrl: 'https://public.example.test',
        runtime: 'browser',
      })
      expect.unreachable()
    } catch (error) {
      expect(error instanceof ApiClientError).toBe(true)
      const e = error as ApiClientError
      expect(e.status).toBe(503)
      expect(e.path).toBe('/components')
    }
  })

  test('network failure maps to status 0 with the underlying message', async () => {
    try {
      await apiFetchJson('/components', {
        fetchImpl: async () => {
          throw new Error('ECONNREFUSED')
        },
        publicApiUrl: 'https://public.example.test',
        runtime: 'browser',
      })
      expect.unreachable()
    } catch (error) {
      const e = error as ApiClientError
      expect(e.status).toBe(0)
      expect(e.message).toContain('ECONNREFUSED')
    }
  })
})

describe('apiMutateJson', () => {
  test('POSTs JSON with credentials included by default', async () => {
    let seenRequest: { url: string; init: RequestInit } | undefined
    const result = await apiMutateJson<{ status: boolean }>(
      '/auth/request-password-reset',
      { email: 'user@example.com' },
      {
        fetchImpl: async (url, init) => {
          seenRequest = { url: String(url), init: init as RequestInit }
          return new Response(JSON.stringify({ status: true }), { status: 200 })
        },
        publicApiUrl: 'https://public.example.test',
        runtime: 'browser',
      },
    )
    expect(result.status).toBe(true)
    expect(seenRequest?.url).toBe('https://public.example.test/auth/request-password-reset')
    expect(seenRequest?.init.method).toBe('POST')
    expect(seenRequest?.init.credentials).toBe('include')
    expect(JSON.parse(String(seenRequest?.init.body))).toEqual({ email: 'user@example.com' })
  })

  test('non-2xx surfaces the response body code + message on ApiClientError', async () => {
    try {
      await apiMutateJson(
        '/auth/reset-password',
        { token: 'bad', newPassword: 'longenough' },
        {
          fetchImpl: async () =>
            new Response(JSON.stringify({ message: 'Invalid token', code: 'INVALID_TOKEN' }), {
              status: 400,
            }),
          publicApiUrl: 'https://public.example.test',
          runtime: 'browser',
        },
      )
      expect.unreachable()
    } catch (error) {
      expect(error instanceof ApiClientError).toBe(true)
      const e = error as ApiClientError
      expect(e.status).toBe(400)
      expect(e.code).toBe('INVALID_TOKEN')
      expect(e.message).toContain('Invalid token')
    }
  })

  test('non-JSON error body falls back to statusText, no code', async () => {
    try {
      await apiMutateJson(
        '/auth/request-password-reset',
        { email: 'user@example.com' },
        {
          fetchImpl: async () =>
            new Response('not json', { status: 500, statusText: 'Server Error' }),
          publicApiUrl: 'https://public.example.test',
          runtime: 'browser',
        },
      )
      expect.unreachable()
    } catch (error) {
      const e = error as ApiClientError
      expect(e.status).toBe(500)
      expect(e.code).toBeUndefined()
      expect(e.message).toContain('Server Error')
    }
  })
})
