import { describe, expect, test } from 'bun:test'

import { parseCatalogList } from './catalog-client'

const ITEM = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'button',
  name: 'Button',
  summary: 'A button.',
  description: 'A button for the catalog.',
  category: 'react-component',
  tags: [],
  latestVersion: '0.1.0',
  author: 'Luva',
  isPublished: true,
  accessTier: 'free',
} as const

describe('parseCatalogList', () => {
  test('accepts a catalog page from the shared contract', () => {
    const page = parseCatalogList({ items: [ITEM], page: 1, pageSize: 12, total: 1 })
    expect(page.items[0]?.slug).toBe('button')
    expect(page.items[0]?.accessTier).toBe('free')
  })

  test('rejects a payload that is not a catalog page', () => {
    expect(() => parseCatalogList({ items: [] })).toThrow()
  })
})
