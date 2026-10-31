/**
 * Catalog data layer — the ONLY module allowed to know where catalog data
 * comes from. Pages/components receive results and stay transport-agnostic,
 * so the mock source can be swapped for the HTTP source without touching UI.
 *
 * Status: the catalog contract is STILL A PROPOSAL (see the shared-contract
 * issue); no types were added to `packages/shared` without Long's review.
 * The local shapes below mirror that proposal exactly so migration later is
 * mechanical: move types to shared, re-point imports, done.
 */

import { ApiClientError, apiFetchJson } from '../../lib/api-client'
import { MOCK_COMPONENTS } from '../../mocks/components'

export type CatalogCategory = 'animation' | 'react-component' | 'tool'

export interface CatalogItem {
  id: string
  slug: string
  name: string
  summary: string
  description: string
  category: CatalogCategory
  tags: string[]
  latestVersion: string
  author: string
  isPublished: boolean
  /** Per-item preview asset; detail page falls back to a generic preview when absent. */
  previewImageUrl?: string
  /** Usage license for the downloaded component, e.g. "MIT". */
  license?: string
}

export interface CatalogListQuery {
  q?: string
  category?: CatalogCategory
  page?: number
  pageSize?: number
}

export interface CatalogListResult {
  items: CatalogItem[]
  page: number
  pageSize: number
  total: number
}

export interface CatalogSource {
  list(query?: CatalogListQuery): Promise<CatalogListResult>
  detail(slug: string): Promise<CatalogItem | null>
}

/* ------------------------------------------------------------------ */
/* Mock source — the default while the backend contract is pending.    */
/* ------------------------------------------------------------------ */

interface MockFilterSpec {
  q?: string
  category?: CatalogCategory
  page: number
  pageSize: number
}

function filterMockComponents(spec: MockFilterSpec): CatalogListResult {
  const { q, category, page, pageSize } = spec
  const needle = q?.trim().toLowerCase() ?? ''
  const CATEGORY_WEIGHT: Record<CatalogCategory, number> = {
    animation: 0,
    'react-component': 1,
    tool: 2,
  }
  const filtered = MOCK_COMPONENTS.filter((item) => {
    const matchesTag = needle
      ? item.name.toLowerCase().includes(needle) ||
        item.summary.toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.toLowerCase().includes(needle))
      : true
    return matchesTag && (category ? item.category === category : true)
  }).sort(
    (a, b) =>
      CATEGORY_WEIGHT[a.category] - CATEGORY_WEIGHT[b.category] ||
      b.latestVersion.localeCompare(a.latestVersion),
  )

  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
  }
}

export function createMockCatalogSource(): CatalogSource {
  return {
    list: async (query = {}) =>
      filterMockComponents({
        q: query.q,
        category: query.category,
        page: Math.max(1, query.page ?? 1),
        pageSize: Math.max(1, query.pageSize ?? 12),
      }),
    detail: async (slug) =>
      MOCK_COMPONENTS.find((item) => item.slug === slug && item.isPublished) ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* HTTP source — typed against the proposed contract; not default.     */
/* ------------------------------------------------------------------ */

interface HttpDeps {
  fetchImpl?: typeof fetch
  publicApiUrl?: string
  internalApiUrl?: string
  runtime?: 'browser' | 'server'
}

export function createHttpCatalogSource(deps: HttpDeps = {}): CatalogSource {
  return {
    list: async (query = {}) => {
      const params = new URLSearchParams()
      if (query.q) params.set('q', query.q)
      if (query.category) params.set('category', query.category)
      params.set('page', String(Math.max(1, query.page ?? 1)))
      params.set('pageSize', String(Math.max(1, query.pageSize ?? 12)))
      const path = `/components?${params.toString()}`
      const payload = await apiFetchJson<CatalogListResult>(path, {
        runtime: deps.runtime,
        fetchImpl: deps.fetchImpl,
        publicApiUrl: deps.publicApiUrl,
        internalApiUrl: deps.internalApiUrl,
      })
      // Minimal presence checks until the real contract is validated in
      // `packages/shared` (contract issue pending Long's review).
      const items = Array.isArray(payload.items) ? payload.items : []
      return {
        items,
        page: typeof payload.page === 'number' ? payload.page : 1,
        pageSize: typeof payload.pageSize === 'number' ? payload.pageSize : items.length,
        total: typeof payload.total === 'number' ? payload.total : items.length,
      }
    },
    detail: async (slug) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
      try {
        const item = await apiFetchJson<CatalogItem | null>(`/components/${slug}`, {
          runtime: deps.runtime,
          fetchImpl: deps.fetchImpl,
          publicApiUrl: deps.publicApiUrl,
          internalApiUrl: deps.internalApiUrl,
        })
        return item ?? null
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null
        throw error
      }
    },
  }
}

/* ------------------------------------------------------------------ */
/* Selection — API_MODE=mock|live (mock is the safe default).          */
/* ------------------------------------------------------------------ */

export type ApiMode = 'mock' | 'live'

export function resolveApiMode(mode = process.env.API_MODE): ApiMode {
  return mode === 'live' ? 'live' : 'mock'
}

/** One call site for pages; swaps data source via API_MODE without UI changes. */
export function getCatalogSource(deps: HttpDeps = {}): CatalogSource {
  return resolveApiMode() === 'live' ? createHttpCatalogSource(deps) : createMockCatalogSource()
}

/* ------------------------------------------------------------------ */
/* Query helpers — server-side parsing of ?q / ?page.                  */
/* ------------------------------------------------------------------ */

/** Parse raw route searchParams into a safe catalog query (clamped page). */
export function parseCatalogQuery(raw: {
  q?: string | string[]
  page?: string | string[]
}): CatalogListQuery & { page: number } {
  const q = typeof raw.q === 'string' ? raw.q : undefined
  const pageRaw = typeof raw.page === 'string' ? Number.parseInt(raw.page, 10) : NaN
  const page = Number.isNaN(pageRaw) ? 1 : Math.min(Math.max(1, pageRaw), 10_000)
  return { q, page }
}
