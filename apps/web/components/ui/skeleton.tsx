/**
 * Skeleton primitive: a grey block shown while content loads. Pages size it to
 * match the final layout so nothing jumps when the content arrives.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`block animate-pulse rounded-md bg-muted ${className}`} />
  )
}

/* Screen-reader text for a loading region. Pair it with `aria-busy` on the region. */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  )
}
