import { describe, expect, test } from 'bun:test'
import { resetPasswordCallbackUrl, verifyEmailCallbackUrl } from './safe-callback-url'

describe('resetPasswordCallbackUrl', () => {
  test('appends the fixed /reset-password path to the given origin', () => {
    expect(resetPasswordCallbackUrl('https://example.com')).toBe(
      'https://example.com/reset-password',
    )
  })
})

describe('verifyEmailCallbackUrl', () => {
  test('appends the fixed /verify-email/success path to the given origin', () => {
    expect(verifyEmailCallbackUrl('https://example.com')).toBe(
      'https://example.com/verify-email/success',
    )
  })
})
