/**
 * Brand lockup — three stacked blocks + wordmark, as drawn in the Figma
 * NavBar (18:93) and Footer (64:109). Links home.
 */
import Link from 'next/link'
import { LogoLockup } from './logo-lockup'

export const BRAND_NAME = 'Luva UI'

/* The mark is sized in em, so the whole lockup grows with the font size. */
const SIZES = {
  default: 'text-xl font-semibold leading-7',
  large: 'text-[22px] font-bold leading-8',
} as const

export function Logo({
  className = '',
  size = 'default',
}: {
  className?: string
  size?: keyof typeof SIZES
}) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${SIZES[size]} ${className}`}
    >
      <LogoLockup name={BRAND_NAME} />
    </Link>
  )
}
