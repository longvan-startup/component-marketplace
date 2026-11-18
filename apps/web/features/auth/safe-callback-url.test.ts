import { describe, expect, test } from 'bun:test'
import {
  resetPasswordCallbackUrl,
  socialCallbackUrl,
  socialErrorCallbackUrl,
  verifyEmailCallbackUrl,
} from './safe-callback-url'

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

describe('social callback URLs', () => {
  test('returns the site root and the login page on the same origin', () => {
    expect(socialCallbackUrl('https://example.com')).toBe('https://example.com/')
    expect(socialErrorCallbackUrl('https://example.com')).toBe('https://example.com/login')
  })
})
