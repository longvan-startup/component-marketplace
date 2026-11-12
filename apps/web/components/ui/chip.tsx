/**
 * Chip — Figma `Chip/Category` (8:67): toggleable filter pill. `selected`
 * maps to the Figma `State=Selected` variant and to `aria-pressed`.
 */
import type { ButtonHTMLAttributes } from 'react'

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  selected?: boolean
}

export function Chip({ children, selected = false, className = '', ...rest }: ChipProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={`inline-flex h-9 items-center whitespace-nowrap rounded-badge border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-foreground hover:bg-muted-hover'} ${className}`}
    >
      {children}
    </button>
  )
}
