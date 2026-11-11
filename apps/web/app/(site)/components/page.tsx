import type { Metadata } from 'next'
import { CatalogSearch } from '@/components/catalog/catalog-search'
import { ComponentCard } from '@/components/catalog/component-card'
import { getCatalogSource, parseCatalogQuery } from '@/features/catalog/catalog-source'

interface CatalogPageProps {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>
}

export const metadata: Metadata = {
  title: 'Components — catalog',
  description: 'Browse reusable UI components & animations published to the marketplace.',
}

/* Catalog listing — Server Component. Data is read ONLY through the catalog
   data layer; the page never imports the mock array or the fetch client. */
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
        <CatalogSearch initialQuery={query.q ?? ''} />
      </header>

      {result.items.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No components match this query yet — try a different keyword.
        </p>
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={item.id} className="min-w-0">
              <ComponentCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
