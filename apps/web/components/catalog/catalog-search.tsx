'use client'

/**
 * Catalog search island — the demo "use client" boundary: the page itself is
 * a Server Component; only this filtered-control needs state/history events.
 * It keeps its query in the URL (?q=…) so results stay shareable and the
 * server-rendered page remains the source of truth.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export function CatalogSearch({
  initialQuery = '',
  category,
}: {
  initialQuery?: string
  category?: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    const trimmed = value.trim()
    if (trimmed) params.set('q', trimmed)
    if (category) params.set('category', category)
    const search = params.toString()
    router.replace(search ? `/components?${search}` : '/components')
  }

  return (
    <search className="flex w-full max-w-md items-center gap-2">
      <form onSubmit={submit} className="flex w-full items-center gap-2">
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Tìm component…"
          aria-label="Tìm component"
        />
        <Button type="submit" size="md">
          Tìm kiếm
        </Button>
      </form>
    </search>
  )
}
