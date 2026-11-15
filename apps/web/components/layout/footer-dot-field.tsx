'use client'

/**
 * Footer dot field. The Figma "Dot Mountain" (purple #7C3AED dots) is the base
 * layer, exactly as designed. Only the mountain reacts: the pointer drags a
 * heat wake through the mountain's own cells, which brighten to the brand
 * purple and cool back over TRAIL_S seconds. The rest of the band keeps its
 * quiet resting grid. Motion is off under prefers-reduced-motion, and the loop
 * sleeps when nothing is warm.
 */
import Image from 'next/image'
import { useEffect, useRef } from 'react'

const CELL = 10
const TRAIL_S = 1.4
const WAKE_CELLS = 3.2
const WARM = 0.01
/* SVG alpha at or above this marks a cell as part of the mountain (0-255) */
const MOUNTAIN_ALPHA = 5
const HEAT_RGB = '124, 58, 237'

type Grid = { cols: number; rows: number; mask: Uint8Array; heat: Float32Array }

export function FooterDotField({ src }: { src: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const grid = useRef<Grid | null>(null)
  const art = useRef<HTMLImageElement | null>(null)
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

    /* Which cells the mountain covers, read from the SVG's own alpha. */
    const buildGrid = (cols: number, rows: number): Grid => {
      const mask = new Uint8Array(cols * rows)
      const img = art.current
      if (img?.naturalWidth) {
        /* the band's faint field is low alpha; the mountain is the dense part */
        const SS = 4
        const off = document.createElement('canvas')
        off.width = cols * SS
        off.height = rows * SS
        const octx = off.getContext('2d')
        if (octx) {
          octx.drawImage(img, 0, 0, cols * SS, rows * SS)
          const data = octx.getImageData(0, 0, cols * SS, rows * SS).data
          const W = cols * SS
          for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
              let peak = 0
              for (let y = 0; y < SS; y++) {
                for (let x = 0; x < SS; x++) {
                  const a = data[((j * SS + y) * W + (i * SS + x)) * 4 + 3]
                  if (a > peak) peak = a
                }
              }
              mask[j * cols + i] = peak >= MOUNTAIN_ALPHA ? 1 : 0
            }
          }
        }
      }
      return { cols, rows, mask, heat: new Float32Array(cols * rows) }
    }

    const draw = (dt: number) => {
      const s = size()
      if (!s) return
      const { w, h, cols, rows } = s
      if (!grid.current || grid.current.cols !== cols || grid.current.rows !== rows) {
        grid.current = buildGrid(cols, rows)
      }
      const g = grid.current
      const decay = Math.exp(-dt / TRAIL_S)
      /* a resting hand keeps the mountain cells under it at full heat */
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
          /* only the mountain's cells that are warm get drawn; the rest of the band stays as the SVG */
          if (!g.mask[k] || e <= 0.02) continue
          ctx.beginPath()
          ctx.arc(x, y, 0.9 + 3.4 * e, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${HEAT_RGB}, ${0.2 + 0.8 * e})`
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

    /* Heat only lands on cells the mountain covers. */
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
          const k = j * g.cols + i
          if (!g.mask[k]) continue
          const d2 = (i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2
          if (d2 >= r * r) continue
          const t = 1 - d2 / (r * r)
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

    /* The SVG is the same file the base layer shows, so its alpha is the mask. */
    const artImage = new window.Image()
    artImage.src = src
    artImage.onload = () => {
      art.current = artImage
      grid.current = null
      draw(0)
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
      art.current = null
    }
  }, [src])

  return (
    <div ref={wrap} className="relative aspect-[1440/350] w-full">
      <Image src={src} alt="" fill unoptimized sizes="100vw" className="object-fill" />
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  )
}
