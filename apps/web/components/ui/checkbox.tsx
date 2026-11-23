/**
 * Checkbox primitive — a round checkbox in the primary colour, with its label as
 * one tap target at least 44px tall. It is still a native input (keyboard, form
 * value and validation all work); only its look is drawn here. `error` shows a
 * message under the label and marks the box invalid.
 */
import type { InputHTMLAttributes, ReactNode } from 'react'

export function Checkbox({
  label,
  error,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; error?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
        <span className="relative flex size-5 shrink-0">
          <input
            {...rest}
            type="checkbox"
            aria-invalid={Boolean(error)}
            className="peer size-5 cursor-pointer appearance-none rounded-full border border-border bg-card transition-colors checked:border-primary checked:bg-primary aria-invalid:border-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
          >
            <path
              d="M2.5 6.2L5 8.6L9.5 3.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>{label}</span>
      </label>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
