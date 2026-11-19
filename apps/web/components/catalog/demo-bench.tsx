'use client'

/**
 * The bench: opens a component's live demo large, with its knobs beside it.
 * Mounted only while open, so its iframe exists only when someone asks for it.
 * Built on the native <dialog>, which brings the focus trap, Esc to close and
 * focus return to the opener.
 */
import Link from 'next/link'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { createKnobsMessage, parseDemoMessage } from '../../features/demo/demo-bridge'
import {
  type DemoManifest,
  type DemoValues,
  defaultValues,
} from '../../features/demo/demo-manifest'
import { buttonClasses } from '../ui/button'
import { KnobControls } from './knob-controls'

/* Ease-in-out on both ways: an ease-out front-loads the motion, so the bench
   jumps to near full size in the first frames and reads as a pop. */
const OPEN_MS = 560
const CLOSE_MS = 400
const EASE_MOVE = 'cubic-bezier(0.65, 0, 0.35, 1)'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* The transform that places `target` on top of `origin`, scaled down to the
   origin's width. Animating from it makes the bench grow out of the card. */
function transformFromOrigin(origin: DOMRect, target: DOMRect): string {
  const dx = origin.left + origin.width / 2 - (target.left + target.width / 2)
  const dy = origin.top + origin.height / 2 - (target.top + target.height / 2)
  const scale = origin.width / target.width
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

export function DemoBench({
  demo,
  name,
  summary,
  originRef,
  onClose,
}: {
  demo: DemoManifest
  name: string
  summary?: string
  /* The card's demo area that opened the bench; the bench animates from it. */
  originRef: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [values, setValues] = useState<DemoValues>(() => defaultValues(demo.knobs))
  const [showFrame, setShowFrame] = useState(false)
  const valuesRef = useRef(values)

  useEffect(() => {
    valuesRef.current = values
    /* Send at most one update per frame, however fast the slider moves. */
    const frame = requestAnimationFrame(() => {
      frameRef.current?.contentWindow?.postMessage(createKnobsMessage(values), '*')
    })
    return () => cancelAnimationFrame(frame)
  }, [values])

  useEffect(() => {
    /* showModal throws when the dialog is already open, so it runs once. It
       focuses the demo iframe first, so move focus to the close button: Esc
       is only handled by the dialog when focus is inside it, not in the iframe. */
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    closeRef.current?.focus()
    /* Strict Mode runs this effect twice. Cancel the first run's animation before
       measuring, or the second run measures the already-moved dialog and
       animates from its final place: the bench then appears with no motion. */
    for (const running of dialog.getAnimations()) running.cancel()

    /* The demo iframe loads only after the opening move ends. Loading it during
       the animation makes the frame stall and the move look like a pop. */
    const origin = originRef.current?.getBoundingClientRect()
    if (!origin || prefersReducedMotion()) {
      setShowFrame(true)
      return
    }
    const animation = dialog.animate(
      [
        { transform: transformFromOrigin(origin, dialog.getBoundingClientRect()), opacity: 0.6 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: OPEN_MS, easing: EASE_MOVE },
    )
    /* The timer is a fallback: a hidden tab can pause the animation, and the
       demo must still appear. */
    animation.onfinish = () => setShowFrame(true)
    const fallback = window.setTimeout(() => setShowFrame(true), OPEN_MS + 150)
    return () => window.clearTimeout(fallback)
  }, [originRef])

  /* Every way out goes through here, so the bench shrinks back into its card
     before the dialog closes. Esc (the native cancel) is intercepted for the
     same reason. */
  const closingRef = useRef(false)
  const requestClose = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog || closingRef.current) return
    closingRef.current = true
    const origin = originRef.current?.getBoundingClientRect()
    if (!origin || prefersReducedMotion()) {
      dialog.close()
      return
    }
    const animation = dialog.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: transformFromOrigin(origin, dialog.getBoundingClientRect()), opacity: 0.6 },
      ],
      { duration: CLOSE_MS, easing: EASE_MOVE, fill: 'forwards' },
    )
    animation.onfinish = () => dialog.close()
  }, [originRef])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      requestClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [requestClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [onClose])

  useEffect(() => {
    /* The demo says "ready" once its script runs; answer with the current
       values so a reopened bench shows the same settings. Only the iframe's
       own window counts as a sender. */
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return
      const message = parseDemoMessage(event.data)
      if (message?.type === 'ready') {
        frameRef.current?.contentWindow?.postMessage(createKnobsMessage(valuesRef.current), '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const handleChange = (key: string, value: number | string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  /* The dialog covers the whole screen, so a click outside the panels lands on
     the dialog itself. Close only when the click falls outside the panels' box. */
  const handleBackdropClick = (event: { clientX: number; clientY: number }) => {
    const box = contentRef.current?.getBoundingClientRect()
    if (!box) return
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    if (!inside) requestClose()
  }

  /* Two separate panels, like bencho: the sandbox on the left, the info and
     controls on the right. The dialog frame is the gap between them. */
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc already closes the native dialog; this click only handles the backdrop
    <dialog
      ref={dialogRef}
      aria-labelledby="demo-bench-title"
      onClick={handleBackdropClick}
      className="m-auto w-[min(1040px,calc(100vw-48px))] bg-transparent p-0 text-foreground shadow-none backdrop:bg-foreground/40"
    >
      <div
        ref={contentRef}
        className="flex flex-col gap-3 md:h-[min(600px,calc(100vh-48px))] md:flex-row md:gap-4"
      >
        <div className="relative min-h-[320px] overflow-hidden rounded-card bg-muted md:min-h-0 md:flex-1">
          {showFrame ? (
            <iframe
              ref={frameRef}
              src={demo.src}
              title={`Demo ${name}`}
              sandbox="allow-scripts"
              className="h-full w-full border-0"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Đang tải demo…
            </span>
          )}
        </div>
        <div className="flex w-full flex-col gap-6 rounded-card bg-muted p-5 md:w-80">
          <div className="flex items-start justify-between gap-3">
            <h2 id="demo-bench-title" className="text-lg font-semibold tracking-tight">
              {name}
            </h2>
            <button
              ref={closeRef}
              type="button"
              aria-label="Đóng"
              onClick={requestClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-badge text-muted-foreground hover:bg-muted-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {summary ? <p className="text-sm leading-5 text-muted-foreground">{summary}</p> : null}
          <KnobControls knobs={demo.knobs} values={values} onChange={handleChange} />
          <Link
            href={`/components/${demo.slug}`}
            className={buttonClasses({ className: 'mt-auto w-full' })}
          >
            Xem thêm
          </Link>
        </div>
      </div>
    </dialog>
  )
}
