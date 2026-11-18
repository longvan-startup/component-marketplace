import { describe, expect, test } from 'bun:test'

import { ApiConfigError, parseApiEnv } from '../src/env'

describe('auth email configuration', () => {
  test('accepts a complete sender pair and rejects invalid or partial configuration', () => {
    const env = parseApiEnv({
      RESEND_API_KEY: ' re_test_key ',
      AUTH_EMAIL_FROM: ' accounts@example.test ',
    })
    expect(env.RESEND_API_KEY).toBe('re_test_key')
    expect(env.AUTH_EMAIL_FROM).toBe('accounts@example.test')
    expect(() => parseApiEnv({ AUTH_EMAIL_FROM: 'not-an-email' })).toThrow(ApiConfigError)
    expect(() => parseApiEnv({ RESEND_API_KEY: 're_test_key' })).toThrow(ApiConfigError)
  })

  test('accepts complete Google and GitHub pairs and rejects a half-configured provider', () => {
    const env = parseApiEnv({
      GOOGLE_CLIENT_ID: ' google-client ',
      GOOGLE_CLIENT_SECRET: ' google-secret ',
      GITHUB_CLIENT_ID: 'github-client',
      GITHUB_CLIENT_SECRET: 'github-secret',
    })
    expect(env.GOOGLE_CLIENT_ID).toBe('google-client')
    expect(env.GITHUB_CLIENT_SECRET).toBe('github-secret')

    try {
      parseApiEnv({ GOOGLE_CLIENT_ID: 'google-client' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiConfigError)
      expect((error as ApiConfigError).message).toContain('GOOGLE_CLIENT_ID')
      expect((error as ApiConfigError).message).not.toContain('google-client')
    }
  })
})
