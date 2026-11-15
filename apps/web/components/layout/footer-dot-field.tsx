'use client'

/**
 * Footer dot field — a halftone of dots over the Figma "Dot Mountain" band.
 * At rest every cell is a dot, and the mountain's own cells are larger and
 * denser. The pointer drags a heat wake through the grid: the cells under the
 * hand thicken and brighten, then cool back to the resting field over
 * TRAIL_S seconds. Motion is off under prefers-reduced-motion, and the loop
 * sleeps when nothing is warm, so an idle footer costs no frames.
 */
import { useEffect, useRef } from 'react'

const CELL = 10
const TRAIL_S = 1.4
const WAKE_CELLS = 2.4
const WARM = 0.01

type Grid = { cols: number; rows: number; mask: Float32Array; heat: Float32Array }

export function FooterDotField({ src, className = '' }: { src: string; className?: string }) {
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

    const build = (image: HTMLImageElement) => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cols = Math.floor(w / CELL)
      const rows = Math.floor(h / CELL)
      const sample = document.createElement('canvas')
      sample.width = cols
      sample.height = rows
      const sctx = sample.getContext('2d')
      if (!sctx) return
      sctx.drawImage(image, 0, 0, cols, rows)
      const alpha = sctx.getImageData(0, 0, cols, rows).data
      const mask = new Float32Array(cols * rows)
      for (let k = 0; k < mask.length; k++) mask[k] = alpha[k * 4 + 3] / 255
      const heat =
        grid.current && grid.current.cols === cols
          ? grid.current.heat
          : new Float32Array(cols * rows)
      grid.current = {
        cols,
        rows,
        mask,
        heat: heat.length === cols * rows ? heat : new Float32Array(cols * rows),
      }
      draw(0)
    }

    const draw = (dt: number) => {
      const g = grid.current
      if (!g) return
      const w = host.clientWidth
      const h = host.clientHeight
      const decay = Math.exp(-dt / TRAIL_S)
      ctx.clearRect(0, 0, w, h)
      const ink = getComputedStyle(cv).color
      const left = (w - g.cols * CELL) / 2
      const top = (h - g.rows * CELL) / 2
      let warm = false
      for (let j = 0; j < g.rows; j++) {
        for (let i = 0; i < g.cols; i++) {
          const k = j * g.cols + i
          g.heat[k] *= decay
          const e = g.heat[k]
          if (e > WARM) warm = true
          const m = g.mask[k]
          const x = left + (i + 0.5 + (j & 1) * 0.5) * CELL
          const y = top + (j + 0.5) * CELL
          ctx.globalAlpha = Math.min(1, 0.16 + 0.22 * m + 0.7 * Math.min(1, e))
          ctx.fillStyle = ink
          ctx.beginPath()
          ctx.arc(x, y, 0.9 + 2.6 * m + 2.2 * Math.min(1, e), 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
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

    const image = new Image()
    image.src = src
    image.onload = () => {
      build(image)
      if (!reduce) {
        host.addEventListener('pointermove', onMove)
        host.addEventListener('pointerleave', onLeave)
      }
    }

    const ro = new ResizeObserver(() => {
      if (image.complete && image.naturalWidth) build(image)
    })
    ro.observe(host)

    return () => {
      ro.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      grid.current = null
    }
  }, [src])

  return (
    <div
      ref={wrap}
      className={`relative h-[240px] w-full text-muted-foreground md:h-[350px] ${className}`}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  )
}
