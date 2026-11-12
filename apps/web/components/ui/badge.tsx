/**
 * Badge primitive — Figma component set `Badge` (8:51), prop `Tone`.
 * Variants are semantic, not decorative; do not add one-off colors per page.
 * Tinted tones use the tone color on a 12% tint of itself.
 */
import type { ReactNode } from 'react'

const BADGE_VARIANTS = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-accent/12 text-accent',
  accent: 'bg-accent-2/12 text-accent-2',
  danger: 'bg-danger/12 text-danger',
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
      className={`inline-flex h-6 items-center gap-1.5 rounded-badge px-2.5 text-xs font-medium ${BADGE_VARIANTS[variant]}`}
    >
      {children}
    </span>
  )
}
