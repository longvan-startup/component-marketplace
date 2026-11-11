/**
 * Header search — Figma `Input/Search` (8:62). A plain GET form to the
 * catalog (`/components?q=…`), so it works without client JavaScript and
 * stays a Server Component.
 */
import { IconSearch } from '../ui/icons'

export function SearchForm({ className = '' }: { className?: string }) {
  return (
    <form
      action="/components"
      method="get"
      className={`flex h-10 items-center gap-2 rounded-badge border border-border bg-card px-3.5 text-muted-foreground focus-within:border-ring focus-within:ring-1 focus-within:ring-ring ${className}`}
    >
      <IconSearch className="shrink-0" />
      <input
        type="search"
        name="q"
        aria-label="Tìm kiếm component"
        placeholder="Tìm kiếm component..."
        className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
    </form>
  )
}
