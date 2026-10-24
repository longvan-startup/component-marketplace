'use client'

/**
 * Catalog search island — the demo "use client" boundary: the page itself is
 * a Server Component; only this filtered-control needs state/history events.
 * It keeps its query in the URL (?q=…) so results stay shareable and the
 * server-rendered page remains the source of truth.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CatalogSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = value.trim()
    router.replace(trimmed ? `/components?q=${encodeURIComponent(trimmed)}` : '/components')
  }

  return (
    <search className="flex w-full max-w-md items-center gap-2">
      <form onSubmit={submit} className="flex w-full items-center gap-2">
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search components…"
          aria-label="Search components"
          className="w-full rounded-card border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="shrink-0 rounded-card bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          Search
        </button>
      </form>
    </search>
  )
}
