import { describe, expect, test } from 'bun:test'

import { type ApiError, apiErrorSchema, PAGINATION_LIMITS } from './common'

describe('pagination constants', () => {
  test('agreed bounds in issue #30', () => {
    expect(PAGINATION_LIMITS).toEqual({
      defaultPage: 1,
      defaultPageSize: 12,
      maxPage: 10_000,
      maxPageSize: 48,
    })
  })
})

describe('apiErrorSchema — the single 4xx/5xx envelope', () => {
  const validError: ApiError = {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    status: 400,
    details: ['page: expected number'],
  }

  test('valid envelope with details PASSES', () => {
    expect(apiErrorSchema.parse(validError)).toEqual(validError)
  })

  test('valid envelope without optional details PASSES', () => {
    expect(
      apiErrorSchema.parse({ code: 'NOT_FOUND', message: 'no such component', status: 404 }),
    ).toEqual({
      code: 'NOT_FOUND',
      message: 'no such component',
      status: 404,
    })
  })

  test('missing message FAILS', () => {
    const { message: _message, ...broken } = validError
    expect(apiErrorSchema.safeParse(broken).success).toBe(false)
  })

  test('status below 400 or above 599 FAILS (3xx/success are not errors)', () => {
    expect(apiErrorSchema.safeParse({ ...validError, status: 302 }).success).toBe(false)
    expect(apiErrorSchema.safeParse({ ...validError, status: 600 }).success).toBe(false)
  })

  test('lowercase error code FAILS (enforced UPPER_SNAKE convention)', () => {
    expect(apiErrorSchema.safeParse({ ...validError, code: 'validation_error' }).success).toBe(
      false,
    )
  })

  test('unknown keys are stripped, never leaked', () => {
    const parsed = apiErrorSchema.parse({ ...validError, stack: 'sensitive' })
    expect('stack' in parsed).toBe(false)
  })
})
