/**
 * Unit tests cho catalog request parsing (issue #31) — pure, không DB.
 * Rule: input bẩn KHÔNG BAO GIỜ chạm Drizzle; error envelope code mới là
 * `VALIDATION_QUERY` (422) / `NOT_FOUND` (404).
 */

import { describe, expect, test } from 'bun:test'

import { ApiHttpError } from '../errors'
import { parseListRequest, parseSlugParam } from './requests'

describe('parseListRequest', () => {
  test('empty query → defaults per contract (page 1, pageSize 12, newest)', () => {
    const request = parseListRequest({})
    expect(request).toEqual({
      sort: 'newest',
      page: 1,
      pageSize: 12,
    })
  })

  test('string query values are coerced per shared schema', () => {
    const request = parseListRequest({
      q: '  hero  ',
      category: 'animation',
      sort: 'name',
      page: '3',
      pageSize: '24',
    })
    expect(request).toEqual({
      q: 'hero', // trimmed bởi hợp đồng
      category: 'animation',
      sort: 'name',
      page: 3,
      pageSize: 24,
    })
  })

  test('invalid page/size/category → 422 VALIDATION_QUERY with path-only details', () => {
    expect(() => parseListRequest({ page: '0' })).toThrow(ApiHttpError)
    try {
      parseListRequest({ page: '0' })
      expect.unreachable()
    } catch (error) {
      const httpError = error as ApiHttpError
      expect(httpError.status).toBe(422)
      expect(httpError.code).toBe('VALIDATION_QUERY')
      // Details nhất định KHÔNG chứa giá trị query echo về client.
      expect(httpError.details?.every((line) => !line.includes('0'))).toBe(true)
    }
  })

  test('unknown query category value → 422 (enum hợp đồng)', () => {
    expect(() => parseListRequest({ category: 'general' })).toThrow(/Invalid query parameters/)
  })

  test('array-shaped query value (trial of ?q=a&q=b) → 422, không crash', () => {
    expect(() => parseListRequest({ q: ['a', 'b'] })).toThrow(ApiHttpError)
  })
})

describe('parseSlugParam', () => {
  test('valid kebab-case slug passes through', () => {
    expect(parseSlugParam('hero-section')).toBe('hero-section')
  })

  test('invalid slug (UPPER_CASE, spaces, empty) → 404 NOT_FOUND', () => {
    for (const invalid of ['Hero', 'two--words', '', 'has space', 'under_score']) {
      try {
        parseSlugParam(invalid)
        expect.unreachable(`${invalid} should be a 404`)
      } catch (error) {
        const httpError = error as ApiHttpError
        expect(httpError.status).toBe(404)
        expect(httpError.code).toBe('NOT_FOUND')
      }
    }
  })
})
