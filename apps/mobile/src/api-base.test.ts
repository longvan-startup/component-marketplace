import { describe, expect, test } from 'bun:test'

import { DEV_API_BASE_URL, resolveApiBaseUrl } from './api-base'

describe('resolveApiBaseUrl', () => {
  test('uses the local API when the env value is missing', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEV_API_BASE_URL)
    expect(resolveApiBaseUrl('')).toBe(DEV_API_BASE_URL)
  })

  test('keeps an absolute URL and drops a trailing slash', () => {
    expect(resolveApiBaseUrl('https://example.com/')).toBe('https://example.com')
  })

  test('rejects a value that is not http(s)', () => {
    expect(() => resolveApiBaseUrl('luva://catalog')).toThrow('absolute http(s) URL')
  })
})
