'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { useGsapScope } from '../../lib/gsap'
import { Badge } from '../ui/badge'
import { orbitPose } from './showcase-orbit-pose'

/* One full turn of the ring, in seconds. Slow, so the cards stay readable. */
const ORBIT_S = 40
const PERSPECTIVE = 1000

/* The first paint is written into the HTML as text. A browser re-writes a long
   number such as -259.8076211353315 as -259.808 when it reads that HTML, so React
   would find the page different from what it expects and report a hydration
   mismatch. Short numbers are read back unchanged. GSAP takes the values over once
   it starts, so the rounding is invisible. */
const tidy = (value: number) => Math.round(value * 100) / 100

export type OrbitCard = {
  id: string
  name: string
  author: string
  categoryLabel: string
  tierLabel?: string
  tierVariant?: 'accent' | 'success'
  image: string
}

/* Real components of the catalog, circling an imaginary centre. They are only
   shown: the whole thing ignores the pointer and is hidden from assistive tech (the
   panel around it is decorative). The server places the cards for the first paint,
   so with prefers-reduced-motion, where GSAP never starts, they simply stay there. */
export function ShowcaseOrbit({ cards }: { cards: OrbitCard[] }) {
  const ringRef = useRef<HTMLDivElement>(null)

  useGsapScope(ringRef, ({ gsap, qa }) => {
    const els = qa<HTMLElement>('[data-orbit-card]')
    const spin = { angle: 0 }
    const render = () => {
      els.forEach((el, index) => {
        const pose = orbitPose(index, els.length, spin.angle)
        gsap.set(el, {
          x: pose.x,
          y: pose.y,
          scale: pose.scale,
          rotationY: pose.rotationY,
          zIndex: pose.zIndex,
          transformPerspective: PERSPECTIVE,
        })
        gsap.set(el.querySelector('[data-orbit-shade]'), { opacity: pose.shade })
      })
    }
    gsap.to(spin, { angle: 360, duration: ORBIT_S, ease: 'none', repeat: -1, onUpdate: render })
  })

  return (
    <div
      ref={ringRef}
      className="pointer-events-none relative h-[420px] w-[560px] shrink-0 select-none scale-[0.55] xl:scale-[0.85] 2xl:scale-100"
    >
      {cards.map((card, index) => {
        const pose = orbitPose(index, cards.length, 0)
        return (
          <div
            key={card.id}
            data-orbit-card
            className="absolute left-1/2 top-1/2 -ml-[140px] -mt-[135px] w-[280px] overflow-hidden will-change-transform rounded-card border border-border bg-card shadow-[0_24px_48px_-8px_rgba(0,0,0,0.4)]"
            style={{
              transform: `translate(${tidy(pose.x)}px, ${tidy(pose.y)}px) scale(${tidy(pose.scale)})`,
              zIndex: pose.zIndex,
            }}
          >
            <div className="relative h-40 w-full">
              {/* Public file. /_next/image currently 404s on this deployment. */}
              <Image
                src={card.image}
                alt=""
                width={280}
                height={160}
                unoptimized
                className="h-40 w-full object-cover"
              />
            </div>
            <span
              data-orbit-shade
              className="absolute inset-0 bg-foreground"
              style={{ opacity: tidy(pose.shade) }}
            />
            <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3.5">
              <p className="truncate text-base font-semibold leading-[22px] text-foreground">
                {card.name}
              </p>
              <p className="truncate text-sm leading-5 text-muted-foreground">by {card.author}</p>
              <div className="flex items-center gap-2 pt-2">
                <Badge>{card.categoryLabel}</Badge>
                {card.tierLabel ? <Badge variant={card.tierVariant}>{card.tierLabel}</Badge> : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
