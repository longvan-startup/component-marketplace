'use client'

/**
 * Desktop header search. Only the search icon takes room in the navbar. The
 * field opens as a panel laid over the nav: GSAP animates its clip-path, which
 * repaints without re-running the navbar's layout on every frame. Esc, or leaving
 * the empty field, closes it. Submitting is a plain GET to the catalog. Reduced
 * motion switches at once.
 */
import { type FormEvent, useLayoutEffect, useRef, useState } from 'react'
import { type GsapScopeApi, prefersReducedMotion, useGsapScope } from '../../lib/gsap'
import { IconButton } from '../ui/icon-button'
import { IconSearch } from '../ui/icons'

const ICON_WIDTH = 44
const OPEN_WIDTH = 360
const OPEN_S = 0.65
const CLOSE_S = 0.45
/* Visible strip = the icon's width; the rest of the panel is clipped away. */
const CLOSED_CLIP = `inset(0 0 0 ${OPEN_WIDTH - ICON_WIDTH}px round 9999px)`
const OPEN_CLIP = 'inset(0 0px 0 0 round 9999px)'

export function NavSearch({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const gsapRef = useRef<GsapScopeApi['gsap'] | null>(null)
  /* Set by expand(), read by the layout effect that runs after the panel's
     `inert` flag has been cleared. */
  const pending = useRef<'open' | null>(null)

  useGsapScope(wrapRef, ({ gsap }) => {
    gsapRef.current = gsap
  })

  useLayoutEffect(() => {
    if (pending.current !== 'open') return
    pending.current = null
    const panel = panelRef.current
    if (!panel) return
    const gsap = gsapRef.current
    if (gsap && !prefersReducedMotion()) {
      gsap.fromTo(
        panel,
        { clipPath: CLOSED_CLIP },
        { clipPath: OPEN_CLIP, duration: OPEN_S, ease: 'power2.out' },
      )
    } else {
      panel.style.clipPath = OPEN_CLIP
    }
    inputRef.current?.focus()
  })

  function expand() {
    if (open) return
    pending.current = 'open'
    setOpen(true)
  }

  function collapse() {
    if (!open) return
    const panel = panelRef.current
    const gsap = gsapRef.current
    const done = () => {
      formRef.current?.reset()
      setOpen(false)
    }
    if (panel && gsap && !prefersReducedMotion()) {
      gsap.to(panel, {
        clipPath: CLOSED_CLIP,
        duration: CLOSE_S,
        ease: 'power2.in',
        onComplete: done,
      })
    } else {
      if (panel) panel.style.clipPath = CLOSED_CLIP
      done()
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      collapse()
    }
  }

  function onBlur(event: React.FocusEvent<HTMLInputElement>) {
    if (!event.currentTarget.value) collapse()
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    /* a plain GET form: let the browser navigate to /components?q=… */
    if (!inputRef.current?.value.trim()) event.preventDefault()
  }

  return (
    <div
      ref={wrapRef}
      className={`relative flex h-11 shrink-0 items-center ${className}`}
      style={{ width: ICON_WIDTH }}
    >
      <div
        ref={panelRef}
        inert={!open}
        style={{ width: OPEN_WIDTH, clipPath: CLOSED_CLIP }}
        className="absolute right-0 top-0 flex h-11 items-center rounded-badge border border-border bg-card"
      >
        <form
          ref={formRef}
          action="/components"
          method="get"
          onSubmit={onSubmit}
          className="flex h-full min-w-0 flex-1 items-center pr-3"
        >
          <input
            ref={inputRef}
            type="search"
            name="q"
            aria-label="Tìm kiếm component"
            spellCheck={false}
            autoComplete="off"
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </form>
        <div aria-hidden="true" className="w-11 shrink-0" />
      </div>
      <IconButton
        label={open ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
        onClick={open ? collapse : expand}
        className="relative z-10 shrink-0"
      >
        <IconSearch />
      </IconButton>
    </div>
  )
}
