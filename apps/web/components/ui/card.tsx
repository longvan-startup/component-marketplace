/**
 * Card primitive — minimal container for commerce-style listing surfaces.
 * Keep the visual center (border + card radius + subtle shadow) here so
 * polish tweaks stay one-line and site-wide.
 */
import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  )
}
