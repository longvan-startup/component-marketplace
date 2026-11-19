'use client'

import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react'
import { type Bubble, makeBubbles } from './hero-bubble-motion'
import { useBubbleDrift } from './use-bubble-drift'

/* The purple bubbles behind the hero text. Each one swells and shrinks on its
   own rhythm (CSS `scale`) and drifts across the hero (JS `transform`). */
export function HeroBubbles() {
  const layerRef = useRef<HTMLDivElement>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])

  /* Layout effects run before the browser paints, so the bubbles appear at
     their random spots in the first frame instead of jumping into place. */
  useLayoutEffect(() => {
    setBubbles(makeBubbles())
  }, [])

  useBubbleDrift(layerRef, bubbles)

  return (
    <div ref={layerRef} className="absolute inset-0 overflow-hidden">
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
    </div>
  )
}
