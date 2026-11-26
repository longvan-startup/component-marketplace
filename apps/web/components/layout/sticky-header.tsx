'use client'

/**
 * The sticky site header. While the page scrolls down it slides out of view, and
 * as soon as it scrolls up it slides back in. Within the first navbar height it
 * always stays. The background (NavBackdrop) is separate and unchanged: it stays
 * transparent at the top and turns solid after scrolling.
 */
import { type ReactNode, useEffect, useRef } from 'react'
import { tweenSlide } from '../../lib/gsap'

/** Never hide inside this top band, the height of the navbar. */
const ALWAYS_VISIBLE_PX = 72
/** Scroll distance in one direction before the header moves. Ignores jitter. */
const DIRECTION_PX = 6
const SLIDE_S = 0.35

export function StickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let hidden = false
    let lastY = window.scrollY
    let travel = 0

    const apply = (next: boolean) => {
      if (next === hidden) return
      hidden = next
      tweenSlide(el, next ? -100 : 0, SLIDE_S)
    }

    const update = () => {
      const y = window.scrollY
      const delta = y - lastY
      lastY = y
      if (y <= ALWAYS_VISIBLE_PX) {
        travel = 0
        apply(false)
        return
      }
      // Count distance in the current direction; a change of direction restarts it.
      travel = Math.sign(travel) === Math.sign(delta) ? travel + delta : delta
      if (travel > DIRECTION_PX) apply(true)
      else if (travel < -DIRECTION_PX) apply(false)
    }

    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <header ref={ref} className="sticky top-0 z-40">
      {children}
    </header>
  )
}
