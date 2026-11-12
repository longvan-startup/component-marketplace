/**
 * Card primitive — container surface: 1px border + card radius (Figma
 * `radius-card` = 16), no shadow. `interactive` adds the Figma
 * `Card/Component` (10:50) hover treatment (primary border).
 */
import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <div
      className={`rounded-card border border-border bg-card ${interactive ? 'transition-colors hover:border-primary focus-within:border-primary' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
