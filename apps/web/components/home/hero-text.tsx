'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { createFrameLoop, prefersReducedMotion } from '../../lib/gsap'
import { PRESS_RADIUS, SPRING_C, SPRING_K } from './use-dot-press'

/* How far a word is pulled toward the pointer and pushed down at the centre.
   The dots use 2.5 and 3 px; words are far bigger, so they move a little more,
   scaled down for small text. Same radius and spring as the dots. */
const PULL = 4
const SINK = 5
const REF_FONT = 64

type Word = { el: HTMLElement; amp: number; ox: number; oy: number; vx: number; vy: number }

/* Wraps the hero heading and subtitle. Each word (a `data-word` span, see
   Words) dents like a dot does: the pointer pulls it a little and presses it
   down, then it springs back. Skipped under prefers-reduced-motion, and the
   loop sleeps when no word is moving. */
export function HeroText({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const section = wrap?.closest('section')
    if (!wrap || !section || prefersReducedMotion()) return

    const words: Word[] = Array.from(wrap.querySelectorAll<HTMLElement>('[data-word]')).map(
      (el) => ({
        el,
        amp: Math.min(
          1,
          Math.max(0.4, Number.parseFloat(getComputedStyle(el).fontSize) / REF_FONT),
        ),
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
      }),
    )
    let pointer: { x: number; y: number } | null = null
    const radius2 = PRESS_RADIUS * PRESS_RADIUS

    const tick = (dt: number) => {
      /* read every position first, then write, so the frame does one layout */
      const rests = words.map((w) => {
        const rect = w.el.getBoundingClientRect()
        return {
          left: rect.left - w.ox,
          right: rect.right - w.ox,
          top: rect.top - w.oy,
          bottom: rect.bottom - w.oy,
        }
      })
      let moving = false
      words.forEach((w, index) => {
        const rest = rests[index]
        let tx = 0
        let ty = 0
        if (pointer && rest) {
          /* distance from the pointer to the word's box; 0 when it is over it */
          const nx = Math.min(Math.max(pointer.x, rest.left), rest.right)
          const ny = Math.min(Math.max(pointer.y, rest.top), rest.bottom)
          const d2 = (pointer.x - nx) ** 2 + (pointer.y - ny) ** 2
          if (d2 < radius2) {
            const press = (1 - d2 / radius2) ** 2
            const dx = pointer.x - (rest.left + rest.right) / 2
            const dy = pointer.y - (rest.top + rest.bottom) / 2
            const dist = Math.hypot(dx, dy) || 1
            tx = (dx / dist) * PULL * w.amp * press
            ty = (dy / dist) * PULL * w.amp * press + SINK * w.amp * press
          }
        }
        w.vx += (SPRING_K * (tx - w.ox) - SPRING_C * w.vx) * dt
        w.vy += (SPRING_K * (ty - w.oy) - SPRING_C * w.vy) * dt
        w.ox += w.vx * dt
        w.oy += w.vy * dt
        if (
          Math.abs(w.ox) + Math.abs(w.oy) + Math.abs(w.vx) + Math.abs(w.vy) < 0.01 &&
          !tx &&
          !ty
        ) {
          w.ox = w.oy = w.vx = w.vy = 0
          w.el.style.transform = ''
          return
        }
        moving = true
        w.el.style.transform = `translate3d(${w.ox}px, ${w.oy}px, 0)`
      })
      if (moving || pointer) loop.wake()
      else loop.sleep()
    }

    const loop = createFrameLoop((dt) => tick(Math.min(1 / 30, dt || 1 / 60)))

    const onMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      loop.wake()
    }
    const onLeave = () => {
      pointer = null
      loop.wake()
    }
    section.addEventListener('pointermove', onMove)
    section.addEventListener('pointerleave', onLeave)
    return () => {
      loop.sleep()
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
      for (const w of words) w.el.style.transform = ''
    }
  }, [])

  return (
    <div ref={wrapRef} className="flex flex-col items-center gap-6">
      {children}
    </div>
  )
}
