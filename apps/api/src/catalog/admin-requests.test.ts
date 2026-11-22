import { describe, expect, test } from 'bun:test'

import { ApiHttpError } from '../errors'
import { parseAdminComponentsListRequest } from './admin-requests'

describe('parseAdminComponentsListRequest', () => {
  test('defaults to both publication states and shared pagination defaults', () => {
    expect(parseAdminComponentsListRequest({})).toEqual({ page: 1, pageSize: 12 })
  })

  test('converts exact query strings and coerces pagination', () => {
    expect(
      parseAdminComponentsListRequest({ published: 'false', page: '2', pageSize: '24' }),
    ).toEqual({ published: false, page: 2, pageSize: 24 })
  })

  test('invalid values return 422 VALIDATION_QUERY without echoing values', () => {
    try {
      parseAdminComponentsListRequest({ published: 'maybe', page: '0' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiHttpError)
      const httpError = error as ApiHttpError
      expect(httpError.status).toBe(422)
      expect(httpError.code).toBe('VALIDATION_QUERY')
      expect(httpError.details?.join(' ')).not.toContain('maybe')
    }
  })

  test('repeated query values are rejected', () => {
    expect(() => parseAdminComponentsListRequest({ published: ['true', 'false'] })).toThrow(
      ApiHttpError,
    )
  })
})
