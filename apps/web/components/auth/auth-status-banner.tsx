/**
 * Presentational status banner for auth forms (loading/success/error states).
 * No dedicated "success"/"warning" tokens exist yet (apps/web/app/globals.css)
 * so success reuses `--color-accent` like Badge's "success" variant does.
 */
import type { ReactNode } from 'react'

const BANNER_VARIANTS = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-accent/15 text-foreground border border-accent',
  error: 'bg-danger/10 text-danger border border-danger',
} as const

export function AuthStatusBanner({
  children,
  variant,
}: {
  children: ReactNode
  variant: keyof typeof BANNER_VARIANTS
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-card px-4 py-3 text-sm ${BANNER_VARIANTS[variant]}`}
    >
      {children}
    </div>
  )
}
