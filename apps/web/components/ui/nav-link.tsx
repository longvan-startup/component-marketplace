/**
 * NavLink — Figma `NavLink` (77:183): muted medium text that turns primary
 * on hover. Used by the NavBar and the Footer columns.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

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
    <Link
      href={href}
      className={`inline-flex items-center rounded-sm px-0.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {children}
    </Link>
  )
}
