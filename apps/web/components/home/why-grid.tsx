'use client'

import { useEffect, useRef } from 'react'
import { type GsapScopeApi, useGsapScope } from '../../lib/gsap'
import { Card } from '../ui/card'

type Gsap = GsapScopeApi['gsap']

/* Entrance: the cards rise out of a blur one after another each time the row
   scrolls into view. Hover: a soft violet light follows the mouse inside the card. */
const RISE_PX = 28
const BLUR_PX = 6
const REVEAL_S = 0.8
const STAGGER_S = 0.12
/* share of the row that must be in view before the cards play */
const REVEAL_AT = 0.3
const LIGHT_IN_S = 0.25
const LIGHT_OUT_S = 0.4

export type WhyItem = { title: string; body: string }

/* The reasons to pick the library, as three numbered cards. Without script, or
   under prefers-reduced-motion, they are plain cards with no entrance and no
   light. */
export function WhyGrid({ items }: { items: readonly WhyItem[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  const gsapRef = useRef<Gsap | null>(null)

  useGsapScope(listRef, ({ gsap }) => {
    gsapRef.current = gsap
  })

  useEffect(() => {
    const list = listRef.current
    const gsap = gsapRef.current
    if (!list || !gsap) return
    const cards = Array.from(list.children) as HTMLElement[]

    const hide = () => {
      gsap.killTweensOf(cards)
      gsap.set(cards, { y: RISE_PX, opacity: 0, filter: `blur(${BLUR_PX}px)` })
    }
    const reveal = () => {
      gsap.killTweensOf(cards)
      gsap.to(cards, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: REVEAL_S,
        stagger: STAGGER_S,
        ease: 'power3.out',
        /* drop the inline filter so the cards do not stay on their own layer */
        onComplete: () => {
          gsap.set(cards, { clearProps: 'filter' })
        },
      })
    }

    /* The cards play when the row is mostly in view and go back to hidden once it
       is fully out of view, so scrolling away and back plays them again. */
    let shown = false
    hide()
    const onScreen = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (!shown && entry.intersectionRatio >= REVEAL_AT) {
          shown = true
          reveal()
        } else if (shown && entry.intersectionRatio === 0) {
          shown = false
          hide()
        }
      },
      { threshold: [0, REVEAL_AT] },
    )
    onScreen.observe(list)

    /* each card tracks the mouse and fades its light in and out */
    const cleanups = cards.map((card) => {
      const light = card.querySelector<HTMLElement>('[data-light]')
      if (!light) return () => {}
      const onMove = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
        card.style.setProperty('--my', `${event.clientY - rect.top}px`)
      }
      const onEnter = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        onMove(event)
        gsap.to(light, { opacity: 1, duration: LIGHT_IN_S, overwrite: 'auto' })
      }
      const onLeave = () => {
        gsap.to(light, { opacity: 0, duration: LIGHT_OUT_S, overwrite: 'auto' })
      }
      card.addEventListener('pointerenter', onEnter)
      card.addEventListener('pointermove', onMove)
      card.addEventListener('pointerleave', onLeave)
      return () => {
        card.removeEventListener('pointerenter', onEnter)
        card.removeEventListener('pointermove', onMove)
        card.removeEventListener('pointerleave', onLeave)
      }
    })

    return () => {
      onScreen.disconnect()
      for (const cleanup of cleanups) cleanup()
      gsap.killTweensOf(cards)
    }
  }, [])

  return (
    <ol ref={listRef} className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.title} className="min-w-0">
          <Card className="relative flex h-full flex-col gap-3 overflow-hidden p-6">
            <span
              data-light
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 [background:radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_srgb,var(--color-violet-300)_40%,transparent),transparent_70%)]"
            />
            <span className="relative font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="relative text-lg font-semibold tracking-tight">{item.title}</h3>
            <p className="relative text-sm leading-6 text-muted-foreground">{item.body}</p>
          </Card>
        </li>
      ))}
    </ol>
  )
}
