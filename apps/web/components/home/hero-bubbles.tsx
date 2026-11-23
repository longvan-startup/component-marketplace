'use client'

import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react'
import { useGsapScope } from '../../lib/gsap'
import { type Bubble, driftPath, makeBubbles } from './hero-bubble-motion'

/* One GSAP tween per step of the drift path. A shorter step follows the bounces
   more closely, at the cost of more tweens. */
const STEP_S = 0.25
const PATH_S = 60

/* The purple bubbles behind the hero text. GSAP swells each bubble on its own
   rhythm and moves it along a precomputed path that bounces off the hero edges.
   Each bubble sits at its own left and top, so the static markup is already in
   place when motion is off (prefers-reduced-motion). */
export function HeroBubbles() {
  const [bubbles, setBubbles] = useState<Bubble[]>([])

  /* Layout effects run before the browser paints, so the bubbles appear at
     their random spots in the first frame instead of jumping into place. */
  useLayoutEffect(() => {
    setBubbles(makeBubbles())
  }, [])

  /* The layer mounts only once the bubbles exist. useGsapScope runs its setup
     once on mount, so the setup must already see the bubbles to tween them. */
  if (bubbles.length === 0) return null
  return <BubbleLayer bubbles={bubbles} />
}

function BubbleLayer({ bubbles }: { bubbles: Bubble[] }) {
  const layerRef = useRef<HTMLDivElement>(null)

  useGsapScope(layerRef, ({ gsap, qa, scope }) => {
    const section = scope.closest('section')
    if (!section) return
    const bounds = section.getBoundingClientRect()
    qa<HTMLElement>('.hero-bubble').forEach((el, index) => {
      const bubble = bubbles[index]
      if (!bubble) return
      const startX = (bubble.left / 100) * bounds.width
      const startY = (bubble.top / 100) * bounds.height

      /* swell and shrink on the bubble's own rhythm; the offset starts it mid-cycle */
      const swell = gsap.fromTo(
        el,
        { scale: 1 },
        {
          scale: bubble.pulseMax,
          duration: bubble.pulseDuration / 2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        },
      )
      swell.time(-bubble.pulseDelay)

      /* drift: x and y are offsets from the CSS left and top, so start at 0 */
      const path = driftPath(bounds.width, bounds.height, bubble, startX, startY, PATH_S, STEP_S)
      const drift = gsap.timeline({ repeat: -1, yoyo: true })
      for (const point of path) {
        drift.to(el, { x: point.x - startX, y: point.y - startY, duration: STEP_S, ease: 'none' })
      }
    })
  })

  return (
    <div ref={layerRef} className="absolute inset-0 overflow-hidden">
      {bubbles.map((bubble) => (
        <span
          key={`${bubble.left}-${bubble.top}`}
          className="hero-bubble absolute rounded-full opacity-60 blur-[28px]"
          style={
            {
              left: `${bubble.left}%`,
              top: `${bubble.top}%`,
              width: bubble.size,
              height: bubble.size,
              backgroundColor: bubble.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
