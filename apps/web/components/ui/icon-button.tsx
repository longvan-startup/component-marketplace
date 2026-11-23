/**
 * Icon-only button: a square ghost button with an accessible name. Use it for
 * toggles and close buttons. `label` becomes the `aria-label`, since there is no
 * visible text.
 */
import type { ButtonHTMLAttributes, Ref } from 'react'

export function IconButton({
  label,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className={`inline-flex size-11 items-center justify-center rounded-badge text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  )
}
