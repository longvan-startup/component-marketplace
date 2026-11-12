/**
 * PageButton — Figma `PageButton` (77:203): 36px round pagination link.
 * `active` is the current page (`aria-current`).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageButton({
  href,
  children,
  active = false,
}: {
  href: string
  children: ReactNode
  active?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex size-9 items-center justify-center rounded-badge text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-primary/12 hover:text-primary'}`}
    >
      {children}
    </Link>
  )
}
