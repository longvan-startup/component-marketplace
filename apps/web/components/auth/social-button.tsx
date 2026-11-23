/**
 * Social sign-in button — Figma `Button/Social` (154:5832). Its shape (34px tall,
 * 10px radius, card surface) differs from the shared `Button`, so it is its own
 * component, reused for every provider.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function SocialButton({
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className="flex h-[34px] w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  )
}
