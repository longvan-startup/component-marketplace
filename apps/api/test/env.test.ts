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
})
