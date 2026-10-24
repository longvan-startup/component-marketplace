import { describe, expect, test } from 'bun:test'
import { MOCK_COMPONENTS } from '../../mocks/components'
import {
  createHttpCatalogSource,
  createMockCatalogSource,
  parseCatalogQuery,
  resolveApiMode,
} from './catalog-source'

const mockSource = createMockCatalogSource()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('mock catalog source', () => {
  test('lists all fixtures with sane paging metadata', async () => {
    const result = await mockSource.list()
    expect(result.total).toBe(MOCK_COMPONENTS.length)
    expect(result.page).toBe(1)
    expect(result.items.length).toBeGreaterThan(0)
  })

  test('filters by q across name, summary and tags (case-insensitive)', async () => {
    const byName = await mockSource.list({ q: 'SPRING' })
    expect(byName.items.map((item) => item.slug)).toEqual(['spring-card-stack'])

    const byTag = await mockSource.list({ q: 'skeleton' })
    expect(byTag.items.length).toBe(1)
    expect(byTag.items[0]?.slug).toBe('shimmer-skeleton-block')
  })

  test('filters by category', async () => {
    const result = await mockSource.list({ category: 'tool' })
    expect(result.items.every((item) => item.category === 'tool')).toBe(true)
    expect(result.total).toBe(2)
  })

  test('paginates deterministically', async () => {
    const page1 = await mockSource.list({ pageSize: 4, page: 1 })
    const page2 = await mockSource.list({ pageSize: 4, page: 2 })
    expect(page1.items.length).toBe(4)
    expect(page1.total).toBe(MOCK_COMPONENTS.length)
    expect(page2.items.length).toBe(MOCK_COMPONENTS.length - 4)
    const page1Slugs = new Set(page1.items.map((item) => item.slug))
    expect(page2.items.every((item) => !page1Slugs.has(item.slug))).toBe(true)
  })

  test('detail returns published item by slug and null for unknown', async () => {
    const found = await mockSource.detail('spring-card-stack')
    expect(found?.name).toBe('Spring Card Stack')

    const unpublished = await mockSource.detail('version-diff-previewer')
    expect(unpublished).toBeNull()

    expect(await mockSource.detail('nope')).toBeNull()
  })
})

describe('source selection + query parsing', () => {
  test('API_MODE defaults to mock even for unknown values', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
    expect(resolveApiMode('')).toBe('mock')
    expect(resolveApiMode('nonsense' as string | undefined)).toBe('mock')
    expect(resolveApiMode('live')).toBe('live')
  })

  test('parseCatalogQuery clamps page and keeps q', () => {
    expect(parseCatalogQuery({})).toEqual({ page: 1 })
    expect(parseCatalogQuery({ q: ' spring ' })).toEqual({ q: ' spring ', page: 1 })
    expect(parseCatalogQuery({ page: '3' })).toEqual({ page: 3 })
    expect(parseCatalogQuery({ page: '-9' })).toEqual({ page: 1 })
    expect(parseCatalogQuery({ page: '999999' })).toEqual({ page: 10000 })
    expect(parseCatalogQuery({ page: ['2'] })).toEqual({ page: 1 })
  })
})

describe('http catalog source (pre-contract, API_MODE=live only)', () => {
  test('list maps pinged payloads into the local shape', async () => {
    const source = createHttpCatalogSource({
      fetchImpl: async () =>
        jsonResponse(200, {
          items: [MOCK_COMPONENTS[0]],
          page: 2,
          pageSize: 11,
          total: 42,
        }),
      publicApiUrl: 'https://api.example.test',
    })
    const result = await source.list({ page: 2, pageSize: 11 })
    expect(result.total).toBe(42)
    expect(result.items.length).toBe(1)
  })

  test('detail maps 404 to null instead of throwing', async () => {
    const source = createHttpCatalogSource({
      fetchImpl: async () => jsonResponse(404, { error: 'not found' }),
      publicApiUrl: 'https://api.example.test',
    })
    expect(await source.detail('missing-slug')).toBeNull()
  })

  test('detail surfaces non-404 failures as ApiClientError-ish throw', async () => {
    const source = createHttpCatalogSource({
      fetchImpl: async () => jsonResponse(500, {}),
      publicApiUrl: 'https://api.example.test',
    })
    await source.detail('broken').then(
      () => {
        throw new Error('expected rejection')
      },
      (error: Error) => {
        expect(error.message).toContain('500')
      },
    )
  })

  test('invalid slug short-circuits without a network call', async () => {
    let calls = 0
    const source = createHttpCatalogSource({
      fetchImpl: async () => {
        calls += 1
        return jsonResponse(200, null)
      },
      publicApiUrl: 'https://api.example.test',
    })
    expect(await source.detail('../injections')).toBeNull()
    expect(calls).toBe(0)
  })
})
