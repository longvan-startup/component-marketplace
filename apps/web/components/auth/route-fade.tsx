'use client'

import { usePathname } from 'next/navigation'
import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { type GsapScopeApi, useGsapScope } from '../../lib/gsap'

const RISE_PX = 10
const FADE_S = 0.45

/* Wraps content that stays on screen while the page around it changes (the auth
   panel and the showcase headline). When the route changes, the new content fades
   in and rises a little instead of snapping in. The first render is left alone,
   so the page does not flicker on load. Under prefers-reduced-motion the GSAP
   setup never runs, so the content just swaps. */
export function RouteFade({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const gsapRef = useRef<GsapScopeApi['gsap'] | null>(null)
  const pathname = usePathname()
  const lastPath = useRef(pathname)

  useGsapScope(ref, ({ gsap }) => {
    gsapRef.current = gsap
  })

  /* a layout effect, so the new content never shows at full strength for a frame */
  useLayoutEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    const gsap = gsapRef.current
    const el = ref.current
    if (!gsap || !el) return
    gsap.fromTo(
      el,
      { opacity: 0, y: RISE_PX },
      {
        opacity: 1,
        y: 0,
        duration: FADE_S,
        ease: 'power2.out',
        overwrite: 'auto',
        clearProps: 'all',
      },
    )
  }, [pathname])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
