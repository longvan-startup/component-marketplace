/**
 * Brand lockup — three stacked blocks + wordmark, as drawn in the Figma
 * NavBar (18:93) and Footer (64:109). Links home.
 */
import Link from 'next/link'
import { LogoLockup } from './logo-lockup'

export const BRAND_NAME = 'Luva UI'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-sm text-xl font-semibold leading-7 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <LogoLockup name={BRAND_NAME} />
    </Link>
  )
}
