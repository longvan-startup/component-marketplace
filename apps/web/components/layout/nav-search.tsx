'use client'

/**
 * Desktop header search. Shows only a search icon; a click opens the field
 * with GSAP, focuses it, and closes again on Esc, on a click away with an empty
 * field, or when the field is left empty. Submitting is a plain GET to the
 * catalog. Reduced motion skips the tween and switches at once.
 */
import { type FormEvent, useLayoutEffect, useRef, useState } from 'react'
import { type GsapScopeApi, prefersReducedMotion, useGsapScope } from '../../lib/gsap'
import { IconButton } from '../ui/icon-button'
import { IconSearch } from '../ui/icons'

const ICON_WIDTH = 44
const OPEN_WIDTH = 360
const OPEN_S = 0.7
const CLOSE_S = 0.5

export function NavSearch({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const gsapRef = useRef<GsapScopeApi['gsap'] | null>(null)
  /* Which way the next width change goes, so the layout effect knows what to animate. */
  const pending = useRef<'open' | 'close' | null>(null)

  useGsapScope(boxRef, ({ gsap }) => {
    gsapRef.current = gsap
  })

  /* After the field mounts, animate it open and focus it. */
  useLayoutEffect(() => {
    if (pending.current !== 'open') return
    pending.current = null
    const box = boxRef.current
    if (!box) return
    const gsap = gsapRef.current
    if (gsap && !prefersReducedMotion()) {
      gsap.fromTo(
        box,
        { width: ICON_WIDTH },
        { width: OPEN_WIDTH, duration: OPEN_S, ease: 'power2.inOut' },
      )
    } else {
      box.style.width = `${OPEN_WIDTH}px`
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
    const box = boxRef.current
    const gsap = gsapRef.current
    const done = () => {
      formRef.current?.reset()
      setOpen(false)
    }
    if (box && gsap && !prefersReducedMotion()) {
      gsap.to(box, { width: ICON_WIDTH, duration: CLOSE_S, ease: 'power2.inOut', onComplete: done })
    } else {
      if (box) box.style.width = `${ICON_WIDTH}px`
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
      ref={boxRef}
      style={{ width: ICON_WIDTH }}
      className={`flex h-11 shrink-0 items-center overflow-hidden rounded-badge ${open ? 'border border-border bg-card' : ''} ${className}`}
    >
      <IconButton
        label={open ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
        onClick={open ? collapse : expand}
        className="shrink-0"
      >
        <IconSearch />
      </IconButton>
      {open ? (
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
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
          />
        </form>
      ) : null}
    </div>
  )
}
