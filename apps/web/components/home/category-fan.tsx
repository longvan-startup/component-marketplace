'use client'

import { Children, isValidElement, type ReactNode, useEffect, useRef } from 'react'
import { type GsapScopeApi, useGsapScope } from '../../lib/gsap'

type Gsap = GsapScopeApi['gsap']

/* The category cards sit like a hand of cards, as on the reference: each one
   lies over the next (card 1 on top, card 2 behind it, card 3 behind that), and
   they alternate between a flat card and cards tilted either way and lifted or
   dropped. They fly out of a
   stack each time the row scrolls into view. The card under the mouse (or the
   keyboard) straightens and rises, and every other card bursts outward to clear
   it. */
const TILTS = [0, 6, -4]
const LIFTS = [0, -24, 20]
/* how much of a card's width the next one covers */
const OVERLAP = 0.18
const HOVER_LIFT = 14
const HOVER_SCALE = 1.05
/* how far the other cards burst away from the one under the mouse */
const BURST_PX = 44
/* the others also relax their tilt by this share while one card is hovered */
const BURST_TILT = 0.5
const IN_S = 0.5
const OUT_S = 0.75
/* share of the row that must be in view before the fan plays */
const PLAY_AT = 0.35
const DESKTOP = '(min-width: 768px)'

type Target = { x: number; y: number; rotation: number; scale: number }

/* The fan only exists on desktop widths and with motion on. Without script, on
   phones, or under prefers-reduced-motion it stays the plain grid of cards. Each
   child is one card. */
export function CategoryFan({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children)
  const listRef = useRef<HTMLUListElement>(null)
  const gsapRef = useRef<Gsap | null>(null)
  const phase = useRef<'flat' | 'pile' | 'fan'>('flat')
  const active = useRef<number | null>(null)
  /* set by the effect, so the pointer handlers can move the cards */
  const placeRef = useRef<((hovered: number | null, animate: boolean) => void) | null>(null)

  useGsapScope(listRef, ({ gsap }) => {
    gsapRef.current = gsap
  })

  useEffect(() => {
    const list = listRef.current
    const gsap = gsapRef.current
    if (!list || !gsap) return
    const items = () => Array.from(list.children) as HTMLElement[]
    const media = window.matchMedia(DESKTOP)
    let played = false

    /* each card sits over the next one: card 1 on top, the last card at the bottom.
       The hovered card tops them all. */
    const restZ = (index: number) => items().length - index
    const HOVER_Z = 50

    /* how far each card is pulled toward the middle one */
    const spacing = () => {
      const [first, second] = items()
      if (!first || !second) return { gap: 0, shift: 0 }
      const gap = second.offsetLeft - first.offsetLeft - first.offsetWidth
      return { gap, shift: gap + first.offsetWidth * OVERLAP }
    }

    const fanTarget = (index: number, count: number, shift: number): Target => ({
      x: -(index - (count - 1) / 2) * shift,
      y: LIFTS[index % LIFTS.length] ?? 0,
      rotation: TILTS[index % TILTS.length] ?? 0,
      scale: 1,
    })

    /* The stacking order changes at once, never mid-move: when the mouse leaves, the
       cards are still apart, so a card dropping back to its place in the pile
       shows no jump, and each neighbour slides over it as they come together. */
    const place = (hovered: number | null, animate: boolean) => {
      const els = items()
      const { shift } = spacing()
      /* the hovered card stays where it is horizontally, so it never slides out from
         under the mouse; the others move relative to it */
      const hoverX = hovered === null ? 0 : fanTarget(hovered, els.length, shift).x
      els.forEach((el, index) => {
        const target = fanTarget(index, els.length, shift)
        if (hovered !== null) {
          if (index === hovered) {
            target.rotation = 0
            target.y = -HOVER_LIFT
            target.scale = HOVER_SCALE
          } else {
            /* burst outward: the overlap is gone and the gap grows by BURST_PX */
            target.x = hoverX + (index < hovered ? -BURST_PX : BURST_PX)
            target.rotation *= BURST_TILT
          }
        }
        gsap.set(el, { zIndex: index === hovered ? HOVER_Z : restZ(index) })
        if (!animate) {
          gsap.set(el, target)
          return
        }
        gsap.to(el, {
          ...target,
          duration: hovered === null ? OUT_S : IN_S,
          ease: hovered === null ? 'power2.inOut' : 'power3.out',
          overwrite: 'auto',
        })
      })
    }

    /* cards waiting in one stack, hidden, until the row scrolls into view */
    const pile = () => {
      const els = items()
      const { gap } = spacing()
      const spread = (els[0]?.offsetWidth ?? 0) + gap
      els.forEach((el, index) => {
        gsap.set(el, {
          x: -(index - (els.length - 1) / 2) * spread,
          y: 40,
          rotation: 0,
          scale: 0.96,
          opacity: 0,
          zIndex: restZ(index),
        })
      })
    }

    const play = () => {
      played = true
      phase.current = 'fan'
      const els = items()
      const { shift } = spacing()
      els.forEach((el, index) => {
        gsap.to(el, {
          ...fanTarget(index, els.length, shift),
          opacity: 1,
          duration: 0.9,
          delay: index * 0.08,
          ease: 'back.out(1.4)',
          overwrite: 'auto',
        })
      })
    }

    const setup = () => {
      gsap.killTweensOf(items())
      if (!media.matches) {
        gsap.set(items(), { clearProps: 'all' })
        phase.current = 'flat'
      } else if (played) {
        phase.current = 'fan'
        place(active.current, false)
      } else {
        phase.current = 'pile'
        pile()
      }
    }

    setup()
    media.addEventListener('change', setup)
    /* The fan plays when the row is mostly in view and goes back to the stack once
       it is fully out of view, so scrolling away and back plays it again. */
    const onScreen = new IntersectionObserver(
      ([entry]) => {
        if (!entry || !media.matches) return
        if (phase.current === 'pile' && entry.intersectionRatio >= PLAY_AT) {
          play()
        } else if (phase.current === 'fan' && entry.intersectionRatio === 0) {
          played = false
          active.current = null
          gsap.killTweensOf(items())
          phase.current = 'pile'
          pile()
        }
      },
      { threshold: [0, PLAY_AT] },
    )
    onScreen.observe(list)
    const resize = new ResizeObserver(() => {
      if (phase.current === 'fan' && !gsap.isTweening(items())) place(active.current, false)
    })
    resize.observe(list)

    placeRef.current = place
    return () => {
      media.removeEventListener('change', setup)
      onScreen.disconnect()
      resize.disconnect()
      gsap.killTweensOf(items())
    }
  }, [])

  const hover = (index: number | null) => {
    if (phase.current !== 'fan' || index === active.current) return
    active.current = index
    placeRef.current?.(index, true)
  }

  const indexOf = (target: EventTarget) => {
    const item = (target as Element).closest('li')
    return item ? Array.from(listRef.current?.children ?? []).indexOf(item) : -1
  }

  return (
    <section
      aria-label="Danh mục component"
      onPointerOver={(event) => {
        if (event.pointerType === 'touch') return
        const index = indexOf(event.target)
        if (index >= 0) hover(index)
      }}
      onPointerLeave={() => hover(null)}
      onFocus={(event) => {
        if (!event.target.matches(':focus-visible')) return
        const index = indexOf(event.target)
        if (index >= 0) hover(index)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hover(null)
      }}
    >
      <ul ref={listRef} className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <li key={isValidElement(card) ? card.key : undefined} className="min-w-0">
            {card}
          </li>
        ))}
      </ul>
    </section>
  )
}
