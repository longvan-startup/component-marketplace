/**
 * Button primitive — primary submit button for forms. `loading` disables the
 * button and swaps its label so a slow request can't be double-submitted;
 * it does not replace `disabled`, which callers still control for empty/
 * invalid state.
 */
import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  loadingLabel?: string
}

export function Button({
  children,
  loading = false,
  loadingLabel = 'Đang xử lý…',
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center rounded-card bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {loading ? loadingLabel : children}
    </button>
  )
}
