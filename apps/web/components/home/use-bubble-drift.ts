'use client'

import { type RefObject, useLayoutEffect } from 'react'
import {
  type Bubble,
  randomBetween,
  SPEED_MAX,
  SPEED_MIN,
  TURN_MAX,
  TURN_WAIT_MAX,
  TURN_WAIT_MIN,
} from './hero-bubble-motion'

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

/* Moves each bubble in a straight line at its own constant speed, turns it to
   a new random heading now and then, and reflects it off the hero's edges like
   a ping-pong ball. Writes only `transform`, so the CSS pulse on `scale` is not
   affected. Skipped under prefers-reduced-motion. */
export function useBubbleDrift(layerRef: RefObject<HTMLDivElement | null>, bubbles: Bubble[]) {
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
  }, [layerRef, bubbles])
}
