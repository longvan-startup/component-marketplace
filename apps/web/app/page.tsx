import Link from 'next/link'
import { getCatalogSource } from '@/features/catalog/catalog-source'

/* Landing page — Server Component reading the catalog data layer directly.
   Mock by default (API_MODE), same code path the live adapter will use. */

export default async function HomePage() {
  const source = getCatalogSource()
  const { items, total } = await source.list({ pageSize: 99 })
  const highlights = items.slice(0, 4)

  return (
    <section className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Component marketplace cho developers
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Bộ sưu tập các UI components &amp; animations có thể tái sử dụng — bản demo listing chạy
          bằng mock data, sẵn sàng chuyển sang HTTP adapter khi backend công khai contract.
        </p>
        <div className="mt-5 flex items-center gap-4">
          <Link
            href="/components"
            className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            Browse components
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {total} catalog entries · mock data
          </span>
        </div>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((item) => (
          <li key={item.id} className="min-w-0">
            <Link
              href={`/components/${item.slug}`}
              className="block rounded-card border border-border bg-card p-4 text-sm hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block truncate font-medium">{item.name}</span>
              <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                /{item.slug}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
