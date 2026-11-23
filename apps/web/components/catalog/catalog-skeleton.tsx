/* Placeholders shown while a catalog page streams its data. They match the
   final layout so the page does not jump when the real content arrives. */
const CARD_IDS = ['card-a', 'card-b', 'card-c', 'card-d', 'card-e', 'card-f'] as const

function Bar({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`block animate-pulse rounded-md bg-muted ${className}`} />
  )
}

export function CatalogListSkeleton() {
  return (
    <section aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        Đang tải danh sách component…
      </span>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Bar className="h-7 w-40" />
          <Bar className="h-4 w-72" />
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        <Bar className="h-8 w-20" />
        <Bar className="h-8 w-28" />
        <Bar className="h-8 w-24" />
      </div>
      <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARD_IDS.map((id) => (
          <li
            key={id}
            className="min-w-0 overflow-hidden rounded-card border border-border bg-card"
          >
            <Bar className="h-48 w-full rounded-none" />
            <div className="flex flex-col gap-3 p-5">
              <Bar className="h-5 w-3/4" />
              <Bar className="h-4 w-1/2" />
              <div className="mt-2 flex gap-2">
                <Bar className="h-6 w-16" />
                <Bar className="h-6 w-14" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ComponentDetailSkeleton() {
  return (
    <section aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        Đang tải component…
      </span>
      <Bar className="h-4 w-32" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Bar className="h-7 w-56" />
          <Bar className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Bar className="h-6 w-16" />
          <Bar className="h-6 w-14" />
        </div>
      </header>
      <Bar className="h-64 w-full" />
      <div className="flex flex-col gap-2">
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-5/6" />
      </div>
    </section>
  )
}
