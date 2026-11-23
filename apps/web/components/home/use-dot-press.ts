'use client'

import { type RefObject, useEffect } from 'react'
import { readTokenRgb } from '../../lib/color'
import { createFrameLoop } from '../../lib/gsap'

/* Figma frame the dots come from (node 185:4442). */
const DOT_FRAME = { width: 1440, height: 480 }
const DOT_SRC = '/hero/halftone-dots.svg'
/* Small press radius, as in the reference. */
const PRESS_RADIUS = 56
/* How far a dot is pulled toward the pointer and pushed down at the centre.
   Kept small so the dots dent instead of following the pointer. */
const PULL = 2.5
const SINK = 3
/* Spring that returns a dot to rest: k sets speed, c sets damping, so the
   return overshoots a little. */
const SPRING_K = 320
const SPRING_C = 15
const FADE_IN = 0.35
const FADE_OUT = 0.12
export const DOT_SCALE = 1.4

type Dot = {
  x: number
  y: number
  r: number
  /* how much the pointer presses this dot right now, 0 to 1 */
  press: number
  /* visible strength, eases toward press */
  show: number
  /* displacement from rest, in section px, and its velocity */
  ox: number
  oy: number
  vx: number
  vy: number
}
type Point = { x: number; y: number }

/* Draws the halftone dots on the canvas. They stay hidden until the pointer
   presses them: a dot under the pointer dents toward it, then springs back.
   Skipped under prefers-reduced-motion, and the loop stops when nothing moves. */
export function useDotPress(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    const section = canvas?.closest('section')
    if (!canvas || !section) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rgb = readTokenRgb(canvas, '--color-violet-600')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let dots: Dot[] = []
    let pointer: Point | null = null
    let dead = false

    /* Canvas size and the artwork's cover mapping. */
    const layout = () => {
      const rect = section.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = rect.width
      const h = rect.height
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const base = Math.max(w / DOT_FRAME.width, h / DOT_FRAME.height)
      return {
        w,
        h,
        base,
        offsetX: (w - DOT_FRAME.width * base) / 2,
        offsetY: (h - DOT_FRAME.height * base) / 2,
      }
    }

    const tick = (dt: number) => {
      const l = layout()
      const radius2 = PRESS_RADIUS * PRESS_RADIUS
      let moving = false

      ctx.clearRect(0, 0, l.w, l.h)

      for (const d of dots) {
        /* where the dot sits at rest, in section px */
        const bx = d.x * l.base + l.offsetX
        const by = d.y * l.base + l.offsetY

        /* press: a dot under the pointer is pulled toward it and sinks */
        let tx = 0
        let ty = 0
        let targetPress = 0
        if (pointer) {
          const dx = pointer.x - bx
          const dy = pointer.y - by
          const d2 = dx * dx + dy * dy
          if (d2 < radius2) {
            const f = 1 - d2 / radius2
            targetPress = f * f
            const dist = Math.sqrt(d2) || 1
            tx = (dx / dist) * PULL * targetPress
            ty = (dy / dist) * PULL * targetPress + SINK * targetPress
          }
        }
        d.press += (targetPress - d.press) * Math.min(1, dt * 14)

        /* spring toward the pressed target, or back to rest when released */
        d.vx += (SPRING_K * (tx - d.ox) - SPRING_C * d.vx) * dt
        d.vy += (SPRING_K * (ty - d.oy) - SPRING_C * d.vy) * dt
        d.ox += d.vx * dt
        d.oy += d.vy * dt

        /* visibility eases in under the pointer and out after it */
        const targetShow = Math.max(d.press, Math.min(1, Math.abs(d.ox) + Math.abs(d.oy)))
        d.show +=
          (targetShow - d.show) *
          Math.min(1, dt * (targetShow > d.show ? FADE_IN * 10 : FADE_OUT * 10))

        if (d.show < 0.01 && Math.abs(d.vx) < 0.01 && Math.abs(d.vy) < 0.01 && d.press < 0.01) {
          d.show = 0
          d.ox = 0
          d.oy = 0
          d.vx = 0
          d.vy = 0
          continue
        }
        moving = true

        ctx.beginPath()
        ctx.arc(
          bx + d.ox,
          by + d.oy,
          d.r * l.base * DOT_SCALE * (1 + 0.25 * d.press),
          0,
          Math.PI * 2,
        )
        ctx.fillStyle = `rgba(${rgb}, ${Math.min(1, d.show) * 0.9})`
        ctx.fill()
      }

      if (moving || pointer) loop.wake()
      else loop.sleep()
    }

    const loop = createFrameLoop((dt) => tick(Math.min(1 / 30, dt || 1 / 60)))
    const wake = () => loop.wake()

    const onMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect()
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      wake()
    }

    const onLeave = () => {
      pointer = null
      wake()
    }

    section.addEventListener('pointermove', onMove)
    section.addEventListener('pointerleave', onLeave)

    fetch(DOT_SRC)
      .then((response) => response.text())
      .then((text) => {
        if (dead) return
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        dots = Array.from(doc.querySelectorAll('circle')).map((el) => ({
          x: Number(el.getAttribute('cx')),
          y: Number(el.getAttribute('cy')),
          r: Number(el.getAttribute('r')),
          press: 0,
          show: 0,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
        }))
      })
      .catch(() => {
        /* without the artwork there is nothing to press; the bubbles still drift */
      })

    return () => {
      dead = true
      loop.sleep()
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
    }
  }, [canvasRef])
}
