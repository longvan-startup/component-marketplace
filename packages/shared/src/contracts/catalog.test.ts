import { describe, expect, test } from 'bun:test'

import {
  type CatalogComponent,
  type CatalogListResponse,
  componentSchema,
  detailResponseSchema,
  listRequestSchema,
  listResponseSchema,
} from './catalog'

/** Valid public DTO fixture — mirrors what the api row mapper must emit. */
const VALID_COMPONENT = {
  id: '0d8f55a7-0c1f-4c2f-98a2-0fbb5f0f5ad1',
  slug: 'spring-card-stack',
  name: 'Spring Card Stack',
  summary: 'Stacked cards with spring stagger on hover and focus.',
  description: 'Long-form description of the spring card stack behavior.',
  category: 'animation',
  tags: ['motion', 'hover'],
  latestVersion: '1.2.0',
  author: 'van',
  isPublished: true,
} as const

const VALID_LIST_RESPONSE: CatalogListResponse = {
  items: [VALID_COMPONENT as CatalogComponent],
  page: 1,
  pageSize: 12,
  total: 1,
}

describe('componentSchema — public DTO', () => {
  test('valid payload PASSES and parses to the exported inferred type', () => {
    const parsed: CatalogComponent = componentSchema.parse(VALID_COMPONENT)
    expect(parsed.slug).toBe('spring-card-stack')
    expect(parsed.category).toBe('animation')
  })

  test('missing required field FAILS', () => {
    const { summary: _summary, ...broken } = VALID_COMPONENT
    expect(componentSchema.safeParse(broken).success).toBe(false)
  })

  test('wrong field type FAILS (tags must be an array)', () => {
    expect(componentSchema.safeParse({ ...VALID_COMPONENT, tags: 'motion' }).success).toBe(false)
  })

  test('malformed uuid / semver / slug FAIL', () => {
    expect(componentSchema.safeParse({ ...VALID_COMPONENT, id: 'not-a-uuid' }).success).toBe(false)
    expect(componentSchema.safeParse({ ...VALID_COMPONENT, latestVersion: '1.2' }).success).toBe(
      false,
    )
    expect(componentSchema.safeParse({ ...VALID_COMPONENT, slug: 'Not A Slug' }).success).toBe(
      false,
    )
  })

  test('DB-only/internal fields are STRIPPED from the parsed public DTO', () => {
    // A careless row spread cannot leak internals past the contract.
    const leaked = {
      ...VALID_COMPONENT,
      authorId: '3f0a95c2-6c22-4a0b-8cc7-aef8cfc7c20b',
      createdAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z',
    }
    const parsed: CatalogComponent = componentSchema.parse(leaked)
    expect('authorId' in parsed).toBe(false)
    expect('createdAt' in parsed).toBe(false)
    expect('updatedAt' in parsed).toBe(false)
  })

  test('tags default to [] when omitted', () => {
    const { tags: _tags, ...withoutTags } = VALID_COMPONENT
    const parsed = componentSchema.parse(withoutTags)
    expect(parsed.tags).toEqual([])
  })
})

describe('listRequestSchema — bounded pagination + sort', () => {
  test('denormalized string query (?page=2&pageSize=24 via GET) coerces correctly', () => {
    const parsed = listRequestSchema.parse({ page: '2', pageSize: '24', q: '  spring  ' })
    expect(parsed).toEqual({ q: 'spring', sort: 'newest', page: 2, pageSize: 24 })
  })

  test('defaults: empty query → page 1, pageSize 12, sort newest', () => {
    expect(listRequestSchema.parse({})).toEqual({ sort: 'newest', page: 1, pageSize: 12 })
  })

  test('zero / negative / oversized page & pageSize FAIL', () => {
    expect(listRequestSchema.safeParse({ page: 0 }).success).toBe(false)
    expect(listRequestSchema.safeParse({ page: -1 }).success).toBe(false)
    expect(listRequestSchema.safeParse({ page: 10_001 }).success).toBe(false)
    expect(listRequestSchema.safeParse({ pageSize: 0 }).success).toBe(false)
    expect(listRequestSchema.safeParse({ pageSize: 49 }).success).toBe(false)
  })

  test('unknown sort value FAILS', () => {
    expect(listRequestSchema.safeParse({ sort: 'cheapest' }).success).toBe(false)
  })
})

describe('listResponseSchema', () => {
  test('valid non-empty response PASSES', () => {
    expect(listResponseSchema.parse(VALID_LIST_RESPONSE)).toEqual(VALID_LIST_RESPONSE)
  })

  test('EMPTY list is a valid response (no matching rows ≠ error)', () => {
    expect(
      listResponseSchema.safeParse({ items: [], page: 3, pageSize: 12, total: 0 }).success,
    ).toBe(true)
  })

  test('negative or fractional total FAILS', () => {
    expect(listResponseSchema.safeParse({ ...VALID_LIST_RESPONSE, total: -1 }).success).toBe(false)
    expect(listResponseSchema.safeParse({ ...VALID_LIST_RESPONSE, total: 1.5 }).success).toBe(false)
  })

  test('item payloads violating componentSchema FAIL', () => {
    const broken = {
      ...VALID_LIST_RESPONSE,
      items: [{ ...VALID_COMPONENT, isPublished: 'yes' }],
    }
    expect(listResponseSchema.safeParse(broken).success).toBe(false)
  })
})

describe('detailResponseSchema — single-item envelope', () => {
  test('valid wrapped detail PASSES', () => {
    const parsed = detailResponseSchema.parse({ item: VALID_COMPONENT })
    expect(parsed.item.slug).toBe('spring-card-stack')
  })

  test('bare unwrapped entity FAILS (envelope is required)', () => {
    expect(detailResponseSchema.safeParse(VALID_COMPONENT).success).toBe(false)
  })
})

describe('type inference parity (no duplicated interface)', () => {
  test('`z.infer` output is assignable in both directions of the contract', () => {
    const parsed = componentSchema.parse(VALID_COMPONENT)
    // Compile-time: parsed must satisfy the exported DTO type and vice versa.
    const asDto: CatalogComponent = parsed
    const fromSchema: typeof parsed = asDto
    expect(fromSchema.name).toBe(VALID_COMPONENT.name)
  })
})
