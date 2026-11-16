'use client'

import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Home hero backdrop. Purple bubbles wander across the whole hero and bounce
   back off its edges, and each one also swells and shrinks on its own rhythm.
   The halftone dot field (Figma node 185:4442) stays hidden until the pointer
   touches it; where it does, the dots dent toward the pointer, then spring
   back. Motion is skipped under prefers-reduced-motion, and each loop stops
   when there is nothing left to animate. */

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
const DOT_SCALE = 1.4
const RGB = '124, 58, 237'

/* Bubble motion, like a ping-pong ball: each bubble moves at its own constant
   speed, bounces off the hero's edges with no loss of speed, and now and then
   turns to a new random heading after a random wait, so its path never repeats. */
const SPEED_MIN = 12
const SPEED_MAX = 22
const TURN_WAIT_MIN = 1.5
const TURN_WAIT_MAX = 4.5
/* largest turn in one step, in radians (about 80 degrees) */
const TURN_MAX = 1.4

type Bubble = {
  size: number
  left: number
  top: number
  color: string
  pulseDuration: number
  pulseDelay: number
  pulseMax: number
}

/* Only purple tones that stay visible on white. The very light #ddd6fe made
   bubbles look like they had disappeared. */
const BUBBLE_COLORS = ['#c4b5fd', '#a78bfa', '#8b5cf6'] as const
const BUBBLE_COUNT = 5

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

/* Each bubble gets its own random size, colour and rhythm, and starts in its
   own column across the width. It is built after mount, so the server and
   client markup never disagree. */
function makeBubbles(): Bubble[] {
  const slot = 100 / BUBBLE_COUNT
  return Array.from({ length: BUBBLE_COUNT }, (_, index) => ({
    size: randomBetween(160, 260),
    left: index * slot + randomBetween(0, slot * 0.6) - slot * 0.3,
    top: randomBetween(-10, 75),
    color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] ?? '#a78bfa',
    /* swell and shrink run on their own rhythm, independent of the drift */
    pulseDuration: randomBetween(4, 6),
    pulseDelay: -randomBetween(0, 6),
    pulseMax: Number(randomBetween(1.05, 1.15).toFixed(2)),
  }))
}

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

type Drifter = {
  el: HTMLElement
  size: number
  x: number
  y: number
  vx: number
  vy: number
  /* constant speed in px per second, and seconds until the next turn */
  speed: number
  turnIn: number
}

export function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)

  /* Dot field: hover presses the dots near the pointer, then they spring back. */
  useEffect(() => {
    const canvas = canvasRef.current
    const section = canvas?.closest('section')
    if (!canvas || !section) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let dots: Dot[] = []
    let pointer: Point | null = null
    let frame = 0
    let last = 0
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

    const tick = (now: number) => {
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60)
      last = now
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
        ctx.fillStyle = `rgba(${RGB}, ${Math.min(1, d.show) * 0.9})`
        ctx.fill()
      }

      frame = moving || pointer ? requestAnimationFrame(tick) : 0
    }

    const wake = () => {
      if (!frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }

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
      if (frame) cancelAnimationFrame(frame)
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const [bubbles, setBubbles] = useState<Bubble[]>([])
  /* Layout effects run before the browser paints, so the bubbles appear at
     their random spots in the first frame instead of jumping into place. */
  useLayoutEffect(() => {
    setBubbles(makeBubbles())
  }, [])

  /* Bubble motion: a straight line at constant speed, reflected off the
     hero's edges like a ping-pong ball. */
  useLayoutEffect(() => {
    const layer = layerRef.current
    const section = layer?.closest('section')
    if (!layer || !section || bubbles.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const bounds = section.getBoundingClientRect()
    const els = Array.from(layer.querySelectorAll<HTMLElement>('.hero-bubble'))
    const drifters: Drifter[] = els.map((el, index) => {
      const bubble = bubbles[index]
      const angle = Math.random() * Math.PI * 2
      const speed = randomBetween(SPEED_MIN, SPEED_MAX)
      return {
        el,
        size: bubble?.size ?? 200,
        x: ((bubble?.left ?? 50) / 100) * bounds.width,
        y: ((bubble?.top ?? 30) / 100) * bounds.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed,
        turnIn: randomBetween(TURN_WAIT_MIN, TURN_WAIT_MAX),
      }
    })

    let frame = 0
    let last = 0
    let dead = false

    const step = (now: number) => {
      if (dead) return
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60)
      last = now
      const { width, height } = section.getBoundingClientRect()

      for (const d of drifters) {
        /* now and then, turn to a new random heading at the same speed */
        d.turnIn -= dt
        if (d.turnIn <= 0) {
          const heading = Math.atan2(d.vy, d.vx) + randomBetween(-TURN_MAX, TURN_MAX)
          d.vx = Math.cos(heading) * d.speed
          d.vy = Math.sin(heading) * d.speed
          d.turnIn = randomBetween(TURN_WAIT_MIN, TURN_WAIT_MAX)
        }

        d.x += d.vx * dt
        d.y += d.vy * dt

        /* ping-pong: reflect off each edge at the same speed */
        const maxX = Math.max(0, width - d.size)
        const maxY = Math.max(0, height - d.size)
        if (d.x < 0) {
          d.x = -d.x
          d.vx = Math.abs(d.vx)
        } else if (d.x > maxX) {
          d.x = 2 * maxX - d.x
          d.vx = -Math.abs(d.vx)
        }
        if (d.y < 0) {
          d.y = -d.y
          d.vy = Math.abs(d.vy)
        } else if (d.y > maxY) {
          d.y = 2 * maxY - d.y
          d.vy = -Math.abs(d.vy)
        }

        d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`
      }

      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => {
      dead = true
      if (frame) cancelAnimationFrame(frame)
    }
  }, [bubbles])

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {bubbles.map((bubble) => (
        <span
          key={`${bubble.left}-${bubble.top}`}
          className="hero-bubble absolute left-0 top-0 rounded-full opacity-60 blur-[28px]"
          style={
            {
              width: bubble.size,
              height: bubble.size,
              backgroundColor: bubble.color,
              '--pulse-dur': `${bubble.pulseDuration}s`,
              '--pulse-delay': `${bubble.pulseDelay}s`,
              '--pulse-max': bubble.pulseMax,
            } as CSSProperties
          }
        />
      ))}
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  )
}
