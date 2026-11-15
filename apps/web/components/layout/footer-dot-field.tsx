'use client'

/**
 * Footer "Dot Mountain". The Figma artwork is 642 purple circles (SVG). This
 * component reads those circles and paints them on a canvas, so the effect acts
 * on the mountain's own dots: where the pointer moves, the dots under it grow
 * and go fully opaque, then cool back to their drawn size over TRAIL_S seconds.
 * A resting pointer keeps the dots under it lit. The SVG image is only a
 * fallback until the circles are read; motion is off under
 * prefers-reduced-motion, and the loop sleeps when nothing is warm.
 */
import { useEffect, useRef } from 'react'

const VIEW_W = 1440
const VIEW_H = 350
const TRAIL_S = 1.4
const WAKE = 70
const WARM = 0.01
const RGB = '124, 58, 237'

type Dot = { x: number; y: number; r: number; a: number; heat: number }

export function FooterDotField({ src }: { src: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const art = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const host = wrap.current
    const cv = canvas.current
    const img = art.current
    if (!host || !cv || !img) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let dots: Dot[] = []
    let frame = 0
    let last = 0
    let pointer: { x: number; y: number } | null = null
    let dead = false

    const fit = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return null
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr)
        cv.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { w, h }
    }

    /* Add heat to the dots within WAKE of a point (CSS px, host space). */
    const stamp = (px: number, py: number) => {
      const size = host.getBoundingClientRect()
      const x = (px / size.width) * VIEW_W
      const y = (py / size.height) * VIEW_H
      const r2 = WAKE * WAKE
      for (const d of dots) {
        const d2 = (d.x - x) ** 2 + (d.y - y) ** 2
        if (d2 >= r2) continue
        const t = 1 - d2 / r2
        d.heat = Math.min(1, d.heat + t * t)
      }
    }

    const draw = (dt: number) => {
      const s = fit()
      if (!s || dead) return
      const kx = s.w / VIEW_W
      const ky = s.h / VIEW_H
      const k = Math.min(kx, ky)
      const decay = Math.exp(-dt / TRAIL_S)
      if (pointer) stamp(pointer.x, pointer.y)
      ctx.clearRect(0, 0, s.w, s.h)
      let warm = false
      for (const d of dots) {
        d.heat *= decay
        if (d.heat > WARM) warm = true
        const e = Math.min(1, d.heat)
        const alpha = d.a + (1 - d.a) * e
        ctx.beginPath()
        ctx.arc(d.x * kx, d.y * ky, d.r * k * (1 + 1.4 * e), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${RGB}, ${alpha})`
        ctx.fill()
      }
      if (warm || pointer) {
        frame = requestAnimationFrame(tick)
      } else {
        frame = 0
      }
    }

    const tick = (now: number) => {
      const dt = last ? (now - last) / 1000 : 0
      last = now
      draw(dt)
    }

    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const prev = pointer
      pointer = { x, y }
      if (prev) {
        const steps = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 6))
        for (let s = 1; s <= steps; s++) {
          stamp(prev.x + ((x - prev.x) * s) / steps, prev.y + ((y - prev.y) * s) / steps)
        }
      } else {
        stamp(x, y)
      }
      if (!frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }

    const onLeave = () => {
      pointer = null
    }

    if (!reduce) {
      host.addEventListener('pointermove', onMove)
      host.addEventListener('pointerleave', onLeave)
    }

    /* Read the artwork's own circles: position, radius and resting opacity. */
    fetch(src)
      .then((response) => response.text())
      .then((text) => {
        if (dead) return
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        dots = Array.from(doc.querySelectorAll('circle')).map((el) => ({
          x: Number(el.getAttribute('cx')),
          y: Number(el.getAttribute('cy')),
          r: Number(el.getAttribute('r')),
          a: Number(el.getAttribute('opacity') ?? 1),
          heat: 0,
        }))
        img.style.visibility = 'hidden'
        draw(0)
      })
      .catch(() => {
        /* keep the static SVG image visible when the artwork cannot be read */
      })

    const ro = new ResizeObserver(() => draw(0))
    ro.observe(host)

    return () => {
      dead = true
      ro.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
      frame = 0
    }
  }, [src])

  return (
    <div ref={wrap} className="relative aspect-[1440/350] w-full">
      {/* biome-ignore lint/performance/noImgElement: static SVG artwork fallback, not a Next-optimised raster */}
      <img ref={art} src={src} alt="" className="absolute inset-0 size-full" draggable={false} />
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  )
}
