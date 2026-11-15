/**
 * NavLink — Figma `NavLink` (77:183): muted medium text that turns primary
 * on hover. Used by the NavBar and the Footer columns.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

/* Shared by every nav item, including planned ones that are not links yet, so
   hover looks identical everywhere. */
export const NAV_LINK_BASE =
  'inline-flex items-center rounded-sm px-0.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function NavLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link href={href} className={`${NAV_LINK_BASE} ${className}`}>
      {children}
    </Link>
  )
}
