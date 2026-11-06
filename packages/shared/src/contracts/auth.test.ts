import { describe, expect, test } from 'bun:test'

import {
  requestPasswordResetRequestSchema,
  requestPasswordResetResponseSchema,
  resendVerificationEmailRequestSchema,
  resendVerificationEmailResponseSchema,
  resetPasswordCallbackErrorSchema,
  resetPasswordRequestSchema,
  resetPasswordResponseSchema,
  verifyEmailCallbackErrorSchema,
} from './auth'

describe('requestPasswordResetRequestSchema', () => {
  test('valid email with redirectTo PASSES', () => {
    expect(
      requestPasswordResetRequestSchema.parse({
        email: 'user@example.com',
        redirectTo: 'https://example.com/reset-password',
      }),
    ).toEqual({ email: 'user@example.com', redirectTo: 'https://example.com/reset-password' })
  })

  test('redirectTo is optional', () => {
    expect(requestPasswordResetRequestSchema.parse({ email: 'user@example.com' })).toEqual({
      email: 'user@example.com',
    })
  })

  test('invalid email FAILS', () => {
    expect(requestPasswordResetRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(
      false,
    )
  })
})

describe('requestPasswordResetResponseSchema', () => {
  test('always-generic non-leaking response PASSES', () => {
    expect(
      requestPasswordResetResponseSchema.parse({
        status: true,
        message: 'If this email exists in our system, check your email for the reset link',
      }),
    ).toEqual({
      status: true,
      message: 'If this email exists in our system, check your email for the reset link',
    })
  })

  test('message is optional', () => {
    expect(requestPasswordResetResponseSchema.parse({ status: true })).toEqual({ status: true })
  })
})

describe('resetPasswordRequestSchema', () => {
  test('valid token + password PASSES', () => {
    expect(
      resetPasswordRequestSchema.parse({ token: 'abc123', newPassword: 'longenough' }),
    ).toEqual({ token: 'abc123', newPassword: 'longenough' })
  })

  test('password shorter than 8 chars FAILS (Better Auth minPasswordLength default)', () => {
    expect(
      resetPasswordRequestSchema.safeParse({ token: 'abc123', newPassword: 'short' }).success,
    ).toBe(false)
  })

  test('password longer than 128 chars FAILS (Better Auth maxPasswordLength default)', () => {
    expect(
      resetPasswordRequestSchema.safeParse({ token: 'abc123', newPassword: 'a'.repeat(129) })
        .success,
    ).toBe(false)
  })

  test('empty token FAILS', () => {
    expect(
      resetPasswordRequestSchema.safeParse({ token: '', newPassword: 'longenough' }).success,
    ).toBe(false)
  })
})

describe('resetPasswordResponseSchema', () => {
  test('{status: true} PASSES', () => {
    expect(resetPasswordResponseSchema.parse({ status: true })).toEqual({ status: true })
  })
})

describe('resetPasswordCallbackErrorSchema', () => {
  test('INVALID_TOKEN PASSES', () => {
    expect(resetPasswordCallbackErrorSchema.parse('INVALID_TOKEN')).toBe('INVALID_TOKEN')
  })

  test('unknown code FAILS', () => {
    expect(resetPasswordCallbackErrorSchema.safeParse('TOKEN_EXPIRED').success).toBe(false)
  })
})

describe('resendVerificationEmailRequestSchema', () => {
  test('valid email with callbackURL PASSES', () => {
    expect(
      resendVerificationEmailRequestSchema.parse({
        email: 'user@example.com',
        callbackURL: 'https://example.com/verify-email?verified=1',
      }),
    ).toEqual({
      email: 'user@example.com',
      callbackURL: 'https://example.com/verify-email?verified=1',
    })
  })

  test('callbackURL is optional', () => {
    expect(resendVerificationEmailRequestSchema.parse({ email: 'user@example.com' })).toEqual({
      email: 'user@example.com',
    })
  })

  test('invalid email FAILS', () => {
    expect(resendVerificationEmailRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(
      false,
    )
  })
})

describe('resendVerificationEmailResponseSchema', () => {
  test('{status: true} PASSES (always generic, non-leaking)', () => {
    expect(resendVerificationEmailResponseSchema.parse({ status: true })).toEqual({
      status: true,
    })
  })
})

describe('verifyEmailCallbackErrorSchema', () => {
  for (const code of ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND']) {
    test(`${code} PASSES`, () => {
      expect(verifyEmailCallbackErrorSchema.parse(code)).toBe(code)
    })
  }

  test('unknown code FAILS', () => {
    expect(verifyEmailCallbackErrorSchema.safeParse('SOMETHING_ELSE').success).toBe(false)
  })
})
