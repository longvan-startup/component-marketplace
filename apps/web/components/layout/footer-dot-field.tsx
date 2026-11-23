'use client'

/**
 * Footer "Dot Mountain". The Figma artwork is 642 purple circles (SVG). This
 * component reads those circles and paints them on a canvas. At rest each one
 * is its drawn dot. Where the pointer moves, the dots under it change into
 * characters from a density ramp (" .:-=+*#%@"): the densest character sits
 * right under the hand, the ramp thins out along the path, and each character
 * leans a little toward the pointer. Hot characters flicker between neighbouring
 * glyphs, then cool back to dots over TRAIL_S seconds. This follows the
 * ASCII-wake technique of bencho.dev (MIT), applied to the mountain's own dots,
 * not to a copied shape. The SVG image is only a fallback until the circles are
 * read. Motion is off under prefers-reduced-motion, and the loop sleeps when
 * nothing is warm.
 */
import { useEffect, useRef } from 'react'
import { readTokenRgb } from '../../lib/color'
import { createFrameLoop } from '../../lib/gsap'

const VIEW_W = 1440
const VIEW_H = 350
const TRAIL_S = 0.7
const WAKE = 60
const WARM = 0.01
/* lightest to densest, the same ramp bencho's "Classic" glyphs use */
const RAMP = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@']
const FONT_FAMILY = `ui-monospace, "SF Mono", Menlo, Consolas, monospace`
const LEAN_PX = 1.5
/* resting dots are drawn a little larger than the artwork so they read as dots */
const DOT_SCALE = 1.5

type Dot = { x: number; y: number; r: number; a: number; heat: number; seed: number }
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
    const RGB = readTokenRgb(cv, '--color-violet-600')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let dots: Dot[] = []
    let tickCount = 0
    let pointer: { x: number; y: number } | null = null
    let dead = false
    const loop = createFrameLoop((dt) => draw(dt))

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
      tickCount += 1
      if (pointer) stamp(pointer.x, pointer.y)
      ctx.clearRect(0, 0, s.w, s.h)
      ctx.font = `700 ${Math.max(8, 10 * k).toFixed(1)}px ${FONT_FAMILY}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let warm = false
      for (const d of dots) {
        d.heat *= decay
        if (d.heat > WARM) warm = true
        const e = Math.min(1, d.heat)
        const px = d.x * kx
        const py = d.y * ky
        /* a cold dot is drawn as the artwork has it, a hot one becomes its glyph in place */
        let index = 0
        if (e > 0.02) {
          index = Math.round(e * (RAMP.length - 1))
          /* the glyph flickers a step up or down now and then */
          if ((tickCount + d.seed) % 3 === 0 && e > 0.25) {
            index = Math.min(RAMP.length - 1, Math.max(0, index + (d.seed % 2 ? 1 : -1)))
          }
        }
        if (index < 3) {
          ctx.beginPath()
          ctx.arc(px, py, d.r * k * DOT_SCALE, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${RGB}, ${d.a})`
          ctx.fill()
          continue
        }
        let lx = 0
        let ly = 0
        if (pointer) {
          const dx = pointer.x - px
          const dy = pointer.y - py
          const dist = Math.hypot(dx, dy) || 1
          const pull = LEAN_PX * e * Math.min(1, (WAKE * k) / dist)
          lx = (dx / dist) * pull
          ly = (dy / dist) * pull
        }
        ctx.fillStyle = `rgba(${RGB}, ${Math.min(1, 0.55 + 0.45 * e)})`
        ctx.fillText(RAMP[index], px + lx, py + ly)
      }
      if (warm || pointer) loop.wake()
      else loop.sleep()
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
      loop.wake()
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
        /* the artwork's own 642 dots, with their drawn size and opacity */
        dots = Array.from(doc.querySelectorAll('circle')).map((el, i) => ({
          x: Number(el.getAttribute('cx')),
          y: Number(el.getAttribute('cy')),
          r: Number(el.getAttribute('r')),
          a: Number(el.getAttribute('opacity') ?? 1),
          heat: 0,
          seed: i,
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
      loop.sleep()
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
