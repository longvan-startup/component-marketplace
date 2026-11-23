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
import { type GsapScopeApi, prefersReducedMotion, useGsapScope } from '../../lib/gsap'
import { buttonClasses } from '../ui/button'
import { IconButton } from '../ui/icon-button'
import { KnobControls } from './knob-controls'

/* Ease-in-out on both ways. An ease-out front-loads the motion, so the bench
   reads as a pop. Motion runs through GSAP, the approved animation entry. */
const OPEN_S = 0.56
const CLOSE_S = 0.4
const EASE = 'power2.inOut'
/* Fallback if a hidden tab pauses GSAP: the demo must still appear. */
const OPEN_FALLBACK_MS = 710

/* The offset and scale that place `target` on top of `origin`. Tweening from
   them makes the bench grow out of the card and shrink back into it. */
function originOffset(origin: DOMRect, target: DOMRect) {
  return {
    x: origin.left + origin.width / 2 - (target.left + target.width / 2),
    y: origin.top + origin.height / 2 - (target.top + target.height / 2),
    scale: origin.width / target.width,
  }
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

  /* Declared before the GSAP hook, so the dialog is open when the hook runs. */
  useEffect(() => {
    /* showModal throws when the dialog is already open, so it runs once. It
       focuses the demo iframe first, so move focus to the close button: Esc
       is only handled by the dialog when focus is inside it, not in the iframe. */
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    closeRef.current?.focus()
    /* With reduced motion the GSAP setup never runs, so show the demo now. */
    if (prefersReducedMotion()) setShowFrame(true)
  }, [])

  /* The GSAP setup runs once, after mount. The demo iframe loads only after the
     opening move ends, so the frame does not stall the animation. */
  const gsapRef = useRef<GsapScopeApi['gsap'] | null>(null)
  useGsapScope(dialogRef, ({ gsap }) => {
    gsapRef.current = gsap
    const dialog = dialogRef.current
    const origin = originRef.current?.getBoundingClientRect()
    if (!dialog || !origin) {
      setShowFrame(true)
      return
    }
    const from = originOffset(origin, dialog.getBoundingClientRect())
    gsap.fromTo(
      dialog,
      { x: from.x, y: from.y, scale: from.scale, opacity: 0.6 },
      {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: OPEN_S,
        ease: EASE,
        onComplete: () => setShowFrame(true),
      },
    )
    window.setTimeout(() => setShowFrame(true), OPEN_FALLBACK_MS)
  })

  /* Every way out goes through here, so the bench shrinks back into its card
     before the dialog closes. Esc (the native cancel) is intercepted for the
     same reason. */
  const closingRef = useRef(false)
  const requestClose = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog || closingRef.current) return
    closingRef.current = true
    const gsap = gsapRef.current
    const origin = originRef.current?.getBoundingClientRect()
    if (!gsap || !origin) {
      dialog.close()
      return
    }
    const to = originOffset(origin, dialog.getBoundingClientRect())
    gsap.to(dialog, {
      x: to.x,
      y: to.y,
      scale: to.scale,
      opacity: 0.6,
      duration: CLOSE_S,
      ease: EASE,
      onComplete: () => dialog.close(),
    })
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
            <IconButton ref={closeRef} label="Đóng" onClick={requestClose}>
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
            </IconButton>
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
