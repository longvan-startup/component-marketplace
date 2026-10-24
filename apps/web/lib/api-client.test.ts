import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { ApiClientError, apiFetchJson, resolveApiBaseUrl } from './api-client'

describe('resolveApiBaseUrl — per-runtime base URL config', () => {
  const SAVED: Record<string, string | undefined> = {}

  beforeAll(() => {
    SAVED.pub = process.env.NEXT_PUBLIC_API_URL
    SAVED.internal = process.env.API_URL_INTERNAL
    process.env.NEXT_PUBLIC_API_URL = 'https://public.example.test'
    process.env.API_URL_INTERNAL = 'http://api:4000'
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_URL = SAVED.pub
    process.env.API_URL_INTERNAL = SAVED.internal
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
