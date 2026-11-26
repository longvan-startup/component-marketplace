'use client'

import {
  Children,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  createFrameLoop,
  type GsapScopeApi,
  prefersReducedMotion,
  useGsapScope,
} from '../../../lib/gsap'
import { IconButton } from '../../ui/icon-button'
import { IconChevronLeft, IconChevronRight } from '../../ui/icons'

type Gsap = GsapScopeApi['gsap']

/* A card cut off by the row's edge swings away like a door: it shrinks, fades
   and turns around its inner edge by up to TURN_DEG. A card that is fully in view
   rests flat. As the row moves, cards swing open as they arrive. */
const TURN_DEG = 14
const SHRINK = 0.1
const FADE = 0.45
const SETTLE_S = 0.3
const PERSPECTIVE = 900

/* The loop: the row drifts left at DRIFT_PX_S and never stops at an end, because
   the cards are listed twice and the row jumps back by one list length, which
   looks the same. It eases to a halt when the mouse arrives and eases back up
   when it leaves. An arrow moves it by one card. */
const DRIFT_PX_S = 36
const HOLD_S = 0.5
const RESUME_S = 0.9
const STEP_S = 0.8
/* Dragging: a pointer must move this far before it counts as a drag and not a
   click, and a flick glides on for FLICK_S after release. */
const DRAG_SLOP_PX = 5
const FLICK_S = 0.8
/* Fewer cards than this would not fill the row twice over, so no loop. */
const LOOP_MIN_CARDS = 4

/* Card widths per breakpoint: about three and a bit cards on desktop, so the next
   one is always peeking in. */
const ITEM_CLASS = 'min-w-0 shrink-0 basis-[80%] snap-start sm:basis-[44%] lg:basis-[28%]'

/* The featured row. Without script, or under prefers-reduced-motion, it is an
   ordinary row you scroll sideways with touch, wheel or keys, snapping to cards,
   with the arrows paging it. With motion on and enough cards, GSAP turns it into
   an endless loop that drifts on its own. Each child is one card. */
export function FeaturedCarousel({
  heading,
  children,
}: {
  heading: ReactNode
  children: ReactNode
}) {
  const cards = Children.toArray(children)
  const canLoop = cards.length >= LOOP_MIN_CARDS
  const [looping, setLooping] = useState(false)
  const [atEdge, setAtEdge] = useState({ start: true, end: false })

  const viewRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const gsapRef = useRef<Gsap | null>(null)
  const loopWidth = useRef(0)
  /* how far the loop has drifted, in px; may sit outside 0..loopWidth between frames */
  const pos = useRef(0)
  /* 1 = full drift speed, 0 = held; eased by GSAP */
  const speed = useRef({ value: 1 })
  const busy = useRef(false)
  const glideRef = useRef<ReturnType<Gsap['to']> | null>(null)
  /* true while a finger or the mouse button holds the row */
  const grabbing = useRef(false)
  const hovering = useRef(false)
  const focused = useRef(false)

  /* Swing the cards at the edges, given how far the row is shifted left. */
  const swing = useCallback((shift: number, smooth: boolean) => {
    const gsap = gsapRef.current
    const view = viewRef.current
    const list = listRef.current
    if (!gsap || !view || !list) return
    for (const card of Array.from(list.children) as HTMLElement[]) {
      const left = card.offsetLeft - shift
      const width = card.offsetWidth
      const share = Math.min(
        1,
        Math.max(0, (Math.min(left + width, view.clientWidth) - Math.max(left, 0)) / width),
      )
      const edge = 1 - share
      const side = left + width / 2 < view.clientWidth / 2 ? -1 : 1
      const vars = {
        scale: 1 - SHRINK * edge,
        opacity: 1 - FADE * edge,
        rotationY: side * TURN_DEG * edge,
        transformPerspective: PERSPECTIVE,
        transformOrigin: side < 0 ? 'right center' : 'left center',
      }
      if (smooth) {
        gsap.to(card, { ...vars, duration: SETTLE_S, ease: 'power2.out', overwrite: 'auto' })
      } else {
        gsap.set(card, vars)
      }
    }
  }, [])

  /* Places the loop at `pos`, wrapped into one list length. */
  const render = useCallback(() => {
    const list = listRef.current
    const gsap = gsapRef.current
    const width = loopWidth.current
    if (!list || !gsap || width <= 0) return
    const shift = ((pos.current % width) + width) % width
    gsap.set(list, { x: -shift })
    swing(shift, false)
  }, [swing])

  /* Scroll mode: edge state for the arrows, and the swing from the scroll offset. */
  const onScroll = useCallback(() => {
    const view = viewRef.current
    if (!view) return
    const start = view.scrollLeft <= 1
    const end = view.scrollLeft + view.clientWidth >= view.scrollWidth - 1
    setAtEdge((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    swing(view.scrollLeft, true)
  }, [swing])

  const stride = useCallback(() => {
    const list = listRef.current
    const first = list?.children[0] as HTMLElement | undefined
    const second = list?.children[1] as HTMLElement | undefined
    if (!first) return 0
    return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
  }, [])

  /* Glides the loop by `delta` px with GSAP, pausing the drift meanwhile. A new
     glide, or a grab, replaces the one in flight. */
  const glide = useCallback((delta: number, duration: number, ease: string) => {
    const gsap = gsapRef.current
    if (!gsap) return
    glideRef.current?.kill()
    busy.current = true
    const from = { p: pos.current }
    glideRef.current = gsap.to(from, {
      p: pos.current + delta,
      duration,
      ease,
      onUpdate: () => {
        pos.current = from.p
      },
      onComplete: () => {
        busy.current = false
      },
    })
  }, [])

  const step = (direction: 1 | -1) => {
    if (looping) {
      glide(direction * stride(), STEP_S, 'power2.inOut')
      return
    }
    viewRef.current?.scrollBy({ left: direction * stride(), behavior: 'auto' })
  }

  /* Eases the drift to a halt, or back up, as the mouse or the keyboard comes and goes. */
  const hold = useCallback((held: boolean) => {
    gsapRef.current?.to(speed.current, {
      value: held ? 0 : 1,
      duration: held ? HOLD_S : RESUME_S,
      ease: 'power2.out',
      overwrite: true,
    })
  }, [])

  useGsapScope(viewRef, ({ gsap }) => {
    gsapRef.current = gsap
    onScroll()
    if (canLoop && !prefersReducedMotion()) setLooping(true)
  })

  /* Measures one list length once the second copy is on screen, keeps it right on
     resize, and drives the drift on GSAP's ticker while the row is on screen. */
  useEffect(() => {
    const view = viewRef.current
    const list = listRef.current
    if (!view || !list || !looping) return
    const measure = () => {
      const first = list.children[0] as HTMLElement | undefined
      const copy = list.children[cards.length] as HTMLElement | undefined
      if (first && copy) loopWidth.current = copy.offsetLeft - first.offsetLeft
      render()
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(view)

    const loop = createFrameLoop((dt) => {
      if (!busy.current && !grabbing.current) {
        pos.current += DRIFT_PX_S * speed.current.value * Math.min(dt, 0.05)
      }
      render()
    })
    const onScreen = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) loop.wake()
      else loop.sleep()
    })
    onScreen.observe(view)

    /* Touchpad and shift+wheel: a sideways swipe moves the row. A mostly vertical
       wheel is left alone, so the page still scrolls. Not passive, to be able to
       stop the browser's own sideways scroll and back-swipe. */
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      event.preventDefault()
      glideRef.current?.kill()
      busy.current = false
      pos.current += event.deltaX
    }

    /* Drag with the mouse or a finger; a flick glides on after release. A drag
       that moved never counts as a click on the card under it. */
    let startX = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let moved = false
    let swallowClick = false
    const onMove = (event: PointerEvent) => {
      const now = performance.now()
      const dx = event.clientX - lastX
      if (!moved && Math.abs(event.clientX - startX) > DRAG_SLOP_PX) moved = true
      if (moved) {
        pos.current -= dx
        if (now > lastT) velocity = (-dx / (now - lastT)) * 1000
      }
      lastX = event.clientX
      lastT = now
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      grabbing.current = false
      if (moved) {
        swallowClick = true
        setTimeout(() => {
          swallowClick = false
        }, 0)
        glide(velocity * FLICK_S * 0.5, FLICK_S, 'power3.out')
      }
      if (!hovering.current && !focused.current) hold(false)
    }
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      glideRef.current?.kill()
      busy.current = false
      grabbing.current = true
      moved = false
      velocity = 0
      startX = lastX = event.clientX
      lastT = performance.now()
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }
    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return
      event.preventDefault()
      event.stopPropagation()
    }
    /* links and images would start the browser's own drag and cancel ours */
    const onDragStart = (event: Event) => event.preventDefault()

    view.addEventListener('wheel', onWheel, { passive: false })
    view.addEventListener('pointerdown', onDown)
    view.addEventListener('click', onClickCapture, true)
    view.addEventListener('dragstart', onDragStart)
    return () => {
      resize.disconnect()
      onScreen.disconnect()
      loop.sleep()
      view.removeEventListener('wheel', onWheel)
      view.removeEventListener('pointerdown', onDown)
      view.removeEventListener('click', onClickCapture, true)
      view.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      glideRef.current?.kill()
      gsapRef.current?.killTweensOf(speed.current)
    }
  }, [looping, cards.length, render, glide, hold])

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Component nổi bật"
      className="flex flex-col gap-8"
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        hovering.current = true
        hold(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'touch') return
        hovering.current = false
        if (!focused.current) hold(false)
      }}
      onFocus={(event) => {
        /* only keyboard focus holds the row; a mouse click on an arrow must not */
        focused.current = event.target.matches(':focus-visible')
        if (focused.current) hold(true)
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        focused.current = false
        if (!hovering.current) hold(false)
      }}
    >
      <div className="flex items-end justify-between gap-4">
        {heading}
        <div className="flex shrink-0 gap-2">
          <IconButton
            label="Xem component trước"
            disabled={!looping && atEdge.start}
            onClick={() => step(-1)}
            className="border border-border"
          >
            <IconChevronLeft />
          </IconButton>
          <IconButton
            label="Xem component tiếp theo"
            disabled={!looping && atEdge.end}
            onClick={() => step(1)}
            className="border border-border"
          >
            <IconChevronRight />
          </IconButton>
        </div>
      </div>
      <div
        ref={viewRef}
        onScroll={looping ? undefined : onScroll}
        className={`-my-4 py-4 ${
          looping
            ? 'touch-pan-y select-none overflow-hidden'
            : 'snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }`}
      >
        <ul ref={listRef} className="relative flex gap-6">
          {cards.map((card) => (
            <li key={isValidElement(card) ? card.key : undefined} className={ITEM_CLASS}>
              {card}
            </li>
          ))}
          {looping
            ? cards.map((card) => (
                <li
                  key={`copy-${isValidElement(card) ? card.key : ''}`}
                  aria-hidden="true"
                  inert
                  className={ITEM_CLASS}
                >
                  {card}
                </li>
              ))
            : null}
        </ul>
      </div>
    </section>
  )
}
