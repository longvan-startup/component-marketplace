/**
 * Social sign-in button, icon only. The provider logo carries the meaning, so the
 * accessible name is passed as `label` and set as `aria-label`. Each button fills
 * half the row, 44px tall, with the card surface and a 10px radius.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function SocialButton({
  icon,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
    </button>
  )
}
