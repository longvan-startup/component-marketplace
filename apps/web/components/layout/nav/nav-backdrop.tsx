'use client'

/**
 * The navbar's background. At the top of the page it is transparent, so the
 * navbar blends into the hero. Once the page scrolls, GSAP fades in the card
 * surface and the bottom border.
 */
import { useEffect, useRef } from 'react'
import { tweenOpacity } from '../../../lib/gsap'

const SOLID_AFTER_PX = 8
const FADE_S = 0.35

export function NavBackdrop() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let solid = false
    const update = () => {
      const next = window.scrollY > SOLID_AFTER_PX
      if (next === solid) return
      solid = next
      tweenOpacity(el, next ? 1 : 0, FADE_S)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 border-b border-border bg-card opacity-0"
    />
  )
}
