/**
 * Button primitive — Figma component set `Button` (84:316): four styles ×
 * three sizes, pill radius. `buttonClasses` is exported so links that look
 * like buttons (NavBar actions) share the exact same visuals.
 *
 * `loading` disables the button and swaps its label so a slow request can't
 * be double-submitted; it does not replace `disabled`, which callers still
 * control for empty/invalid state.
 */
import type { ButtonHTMLAttributes } from 'react'

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed',
  secondary:
    'border border-border bg-muted text-foreground hover:bg-muted-hover active:bg-muted-pressed',
  ghost: 'text-foreground hover:bg-muted active:bg-muted-hover',
  danger: 'bg-danger text-danger-foreground hover:bg-danger-hover active:bg-danger-pressed',
} as const

const BUTTON_SIZES = {
  sm: 'h-8 px-4 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
} as const

export type ButtonVariant = keyof typeof BUTTON_VARIANTS
export type ButtonSize = keyof typeof BUTTON_SIZES

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return `inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-badge font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingLabel?: string
}

export function Button({
  children,
  variant,
  size,
  loading = false,
  loadingLabel = 'Đang xử lý…',
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, className })}
    >
      {loading ? loadingLabel : children}
    </button>
  )
}
