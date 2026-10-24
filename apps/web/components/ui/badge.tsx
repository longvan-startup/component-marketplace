/**
 * Badge primitive — single implementation for every status/content badge.
 * Variants are semantic, not decorative; do not add one-off colors per page.
 */
import type { ReactNode } from 'react'

const BADGE_VARIANTS = {
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-primary text-primary-foreground',
  success: 'bg-accent text-primary-foreground',
} as const

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode
  variant?: keyof typeof BADGE_VARIANTS
}) {
  return (
    <span
      className={`inline-flex items-center rounded-badge px-2.5 py-0.5 text-xs font-medium ${BADGE_VARIANTS[variant]}`}
    >
      {children}
    </span>
  )
}
