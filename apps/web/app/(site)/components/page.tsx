import type { Metadata } from 'next'
import Link from 'next/link'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { ComponentCard } from '@/components/catalog/component-card'
import { CATEGORY_OPTIONS } from '@/features/catalog/catalog-labels'
import {
  type CatalogListQuery,
  getCatalogSource,
  parseCatalogQuery,
} from '@/features/catalog/catalog-source'
import { getDemoManifest } from '@/features/demo/demo-source'

interface CatalogPageProps {
  searchParams: Promise<{
    q?: string | string[]
    category?: string | string[]
    page?: string | string[]
  }>
}

const CATEGORY_FILTERS = [{ value: undefined, label: 'Tất cả' }, ...CATEGORY_OPTIONS] as const

function catalogHref(query: Pick<CatalogListQuery, 'q' | 'category'>) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.category) params.set('category', query.category)
  const search = params.toString()
  return search ? `/components?${search}` : '/components'
}

export const metadata: Metadata = {
  title: 'Components — catalog',
  description: 'Browse reusable UI components & animations published to the marketplace.',
}

/* Catalog listing — Server Component. Data is read ONLY through the catalog
   data layer; the page never imports the mock array or the fetch client.
   Live fetches happen per request; the API is not reachable at build time. */
export const dynamic = 'force-dynamic'

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams
  const query = parseCatalogQuery(params)
  const source = getCatalogSource()
  const result = await source.list(query)

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Components</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} result{result.total === 1 ? '' : 's'}
            {query.q ? ` matching “${query.q}”` : ''} · page {result.page}
          </p>
        </div>
        <CatalogSearch initialQuery={query.q ?? ''} category={query.category} />
      </header>

      <nav aria-label="Lọc danh mục" className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((filter) => {
          const active = (filter.value ?? undefined) === query.category
          return (
            <Link
              key={filter.label}
              href={catalogHref({ q: query.q, category: filter.value })}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'bg-foreground font-medium text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label}
            </Link>
          )
        })}
      </nav>

      {result.unavailable ? (
        <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Catalog tạm thời chưa tải được. Vui lòng thử lại sau.
        </p>
      ) : result.items.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No components match this query yet — try a different keyword.
        </p>
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={item.id} className="min-w-0">
              <ComponentCard item={item} demo={getDemoManifest(item.slug)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
