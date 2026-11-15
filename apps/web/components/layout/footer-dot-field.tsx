'use client'

/**
 * Footer dot field. The Figma "Dot Mountain" (purple #7C3AED dots) is the base
 * layer, exactly as designed. A canvas sits over it with a faint grid of resting
 * dots. The pointer drags a heat wake through that grid: cells under the hand
 * brighten to the brand purple and cool back over TRAIL_S seconds. Motion is off
 * under prefers-reduced-motion, and the loop sleeps when nothing is warm.
 */
import Image from 'next/image'
import { useEffect, useRef } from 'react'

const CELL = 10
const TRAIL_S = 1.4
const WAKE_CELLS = 3.6
const WARM = 0.01
const HEAT_RGB = '124, 58, 237'

type Grid = { cols: number; rows: number; heat: Float32Array }

export function FooterDotField({ src }: { src: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const grid = useRef<Grid | null>(null)
  const frame = useRef(0)
  const last = useRef(0)
  const pointer = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const host = wrap.current
    const cv = canvas.current
    if (!host || !cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const size = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return null
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { w, h, cols: Math.floor(w / CELL), rows: Math.floor(h / CELL) }
    }

    const draw = (dt: number) => {
      const s = size()
      if (!s) return
      const { w, h } = s
      const cols = s.cols
      const rows = s.rows
      if (!grid.current || grid.current.cols !== cols || grid.current.rows !== rows) {
        grid.current = { cols, rows, heat: new Float32Array(cols * rows) }
      }
      const g = grid.current
      const decay = Math.exp(-dt / TRAIL_S)
      /* a resting hand keeps the cells under it at full heat */
      if (pointer.current) stamp(pointer.current.x, pointer.current.y)
      ctx.clearRect(0, 0, w, h)
      const left = (w - cols * CELL) / 2
      const top = (h - rows * CELL) / 2
      let warm = false
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i
          g.heat[k] *= decay
          const e = Math.min(1, g.heat[k])
          if (g.heat[k] > WARM) warm = true
          const x = left + (i + 0.5 + (j & 1) * 0.5) * CELL
          const y = top + (j + 0.5) * CELL
          ctx.beginPath()
          ctx.arc(x, y, 0.9 + 3.4 * e, 0, Math.PI * 2)
          ctx.fillStyle =
            e > 0.02 ? `rgba(${HEAT_RGB}, ${0.2 + 0.8 * e})` : 'rgba(113, 113, 122, 0.32)'
          ctx.fill()
        }
      }
      if (warm || pointer.current) {
        frame.current = requestAnimationFrame(tick)
      } else {
        frame.current = 0
      }
    }

    const tick = (now: number) => {
      const dt = last.current ? (now - last.current) / 1000 : 0
      last.current = now
      draw(dt)
    }

    const stamp = (x: number, y: number) => {
      const g = grid.current
      if (!g) return
      const w = host.clientWidth
      const h = host.clientHeight
      const cx = (x - (w - g.cols * CELL) / 2) / CELL
      const cy = (y - (h - g.rows * CELL) / 2) / CELL
      const r = WAKE_CELLS
      for (
        let j = Math.max(0, Math.floor(cy - r));
        j <= Math.min(g.rows - 1, Math.ceil(cy + r));
        j++
      ) {
        for (
          let i = Math.max(0, Math.floor(cx - r));
          i <= Math.min(g.cols - 1, Math.ceil(cx + r));
          i++
        ) {
          const d2 = (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2
          if (d2 >= r * r) continue
          const t = 1 - d2 / (r * r)
          const k = j * g.cols + i
          g.heat[k] = Math.min(1, g.heat[k] + t * t)
        }
      }
    }

    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const prev = pointer.current
      pointer.current = { x, y }
      if (prev) {
        const steps = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / CELL))
        for (let s = 1; s <= steps; s++) {
          stamp(prev.x + ((x - prev.x) * s) / steps, prev.y + ((y - prev.y) * s) / steps)
        }
      } else {
        stamp(x, y)
      }
      if (!frame.current) frame.current = requestAnimationFrame(tick)
    }

    const onLeave = () => {
      pointer.current = null
    }

    if (!reduce) {
      host.addEventListener('pointermove', onMove)
      host.addEventListener('pointerleave', onLeave)
    }
    const ro = new ResizeObserver(() => {
      grid.current = null
      draw(0)
    })
    ro.observe(host)
    draw(0)

    return () => {
      ro.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      grid.current = null
    }
  }, [])

  return (
    <div ref={wrap} className="relative aspect-[1440/350] w-full">
      <Image src={src} alt="" fill unoptimized sizes="100vw" className="object-fill" />
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  )
}
