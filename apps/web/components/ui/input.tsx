/**
 * Input primitive — text field with the Figma `Input/Search` (8:62) shell:
 * 40px tall, pill radius, 1px border that turns into the ring color on focus.
 * Pair it with `Field` for a label and messages.
 */
import type { InputHTMLAttributes } from 'react'

export const INPUT_CLASSES =
  'h-10 w-full rounded-badge border border-border bg-card px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${INPUT_CLASSES} ${className}`} />
}
