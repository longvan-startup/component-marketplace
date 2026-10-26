/**
 * Unit tests cho catalog mapper (issue #31) — pure, không DB.
 * Assert STRONG: mỗi output PHẢI pass `componentSchema` (contract thật).
 */

import { describe, expect, test } from 'bun:test'

import type { CatalogRow } from './mapper'
import { SUMMARY_MAX_LENGTH, toCatalogComponent } from './mapper'

const BASE_ROW: CatalogRow = {
  id: '0b8b7f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  slug: 'hero-section',
  name: 'Hero Section',
  description: 'A responsive hero section with an overlay title.',
  category: 'react-component',
  tags: ['ui', 'hero'],
  latestVersion: '1.2.3',
  isPublished: true,
  authorName: 'van-dev',
}

describe('toCatalogComponent', () => {
  test('maps a full row to the public contract', () => {
    const dto = toCatalogComponent(BASE_ROW)
    expect(dto).toEqual({
      id: BASE_ROW.id,
      slug: 'hero-section',
      name: 'Hero Section',
      summary: 'A responsive hero section with an overlay title.',
      description: 'A responsive hero section with an overlay title.',
      category: 'react-component',
      tags: ['ui', 'hero'],
      latestVersion: '1.2.3',
      author: 'van-dev',
      isPublished: true,
    })
  })

  test('derives summary from description (interim Option A of #41)', () => {
    const row: CatalogRow = { ...BASE_ROW, description: 'abc'.repeat(300) } // 900 chars
    const dto = toCatalogComponent(row)
    expect(dto.summary.length).toBe(SUMMARY_MAX_LENGTH) // truncated to 300
    expect(dto.summary).toBe('abc'.repeat(100))
  })

  test('falls back to name when description is null/blank', () => {
    const blank: CatalogRow = { ...BASE_ROW, description: null }
    expect(toCatalogComponent(blank).summary).toBe('Hero Section')
    expect(toCatalogComponent(blank).description).toBe('Hero Section')

    const spaces: CatalogRow = { ...BASE_ROW, description: '   ' }
    expect(toCatalogComponent(spaces).description).toBe('Hero Section')
  })

  test('nameless author join → anonymous handle', () => {
    const noAuthor: CatalogRow = { ...BASE_ROW, authorName: null }
    expect(toCatalogComponent(noAuthor).author).toBe('anonymous')

    const blankName: CatalogRow = { ...BASE_ROW, authorName: '   ' }
    expect(toCatalogComponent(blankName).author).toBe('anonymous')
  })

  test('trims author name and keeps it verbatim otherwise', () => {
    const padded: CatalogRow = { ...BASE_ROW, authorName: '  long-vn  ' }
    expect(toCatalogComponent(padded).author).toBe('long-vn')
  })

  test('violating the contract (category outside enum) throws — fail loud', () => {
    const dbDefaultCategory: CatalogRow = { ...BASE_ROW, category: 'general' }
    expect(() => toCatalogComponent(dbDefaultCategory)).toThrow() // ZodError
  })

  test('output has NO internal field (createdAt/authorId...) by construction', () => {
    const dto = toCatalogComponent(BASE_ROW) as Record<string, unknown>
    expect(Object.keys(dto).sort()).toEqual(
      [
        'author',
        'category',
        'description',
        'id',
        'isPublished',
        'latestVersion',
        'name',
        'slug',
        'summary',
        'tags',
      ].sort(),
    )
  })
})
