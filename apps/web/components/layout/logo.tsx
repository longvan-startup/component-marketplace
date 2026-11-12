/**
 * Brand lockup — three stacked blocks + wordmark, as drawn in the Figma
 * NavBar (18:93) and Footer (64:109). Links home.
 */
import Link from 'next/link'

export const BRAND_NAME = 'Luva UI'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-sm text-lg font-semibold leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <span aria-hidden="true" className="relative block size-6 shrink-0">
        <span className="absolute left-px top-3 size-2.5 rounded-[3px] bg-primary-light" />
        <span className="absolute left-[7px] top-1.5 size-2.5 rounded-[3px] bg-primary" />
        <span className="absolute left-[13px] top-0 size-2.5 rounded-[3px] bg-primary-dark" />
      </span>
      {BRAND_NAME}
    </Link>
  )
}
