/**
 * Input primitive — text field with the Figma `Input/Search` (8:62) shell:
 * 40px tall, pill radius, 1px border that turns into the ring color on focus.
 * Pair it with `Field` for a label and messages. Use `variant="bare"` for a
 * field that sits inside another control (search bar, newsletter pill).
 */
import type { InputHTMLAttributes } from 'react'

export const INPUT_CLASSES =
  'h-10 w-full rounded-[10px] border border-border bg-card px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger'

/* Embedded field with no border or background. */
export const BARE_INPUT_CLASSES =
  'min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground'

export function Input({
  className = '',
  variant = 'field',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { variant?: 'field' | 'bare' }) {
  const base = variant === 'bare' ? BARE_INPUT_CLASSES : INPUT_CLASSES
  return <input {...rest} className={`${base} ${className}`} />
}
