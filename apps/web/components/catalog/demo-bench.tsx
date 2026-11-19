'use client'

/**
 * The bench: opens a component's live demo large, with its knobs beside it.
 * Mounted only while open, so its iframe exists only when someone asks for it.
 * Built on the native <dialog>, which brings the focus trap, Esc to close and
 * focus return to the opener.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createKnobsMessage, parseDemoMessage } from '../../features/demo/demo-bridge'
import {
  type DemoManifest,
  type DemoValues,
  defaultValues,
} from '../../features/demo/demo-manifest'
import { buttonClasses } from '../ui/button'
import { KnobControls } from './knob-controls'

export function DemoBench({
  demo,
  name,
  onClose,
}: {
  demo: DemoManifest
  name: string
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [values, setValues] = useState<DemoValues>(() => defaultValues(demo.knobs))
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
    dialogRef.current?.showModal()
    closeRef.current?.focus()
  }, [])

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

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="demo-bench-title"
      className="m-auto w-[min(960px,calc(100vw-32px))] rounded-card border border-border bg-card p-0 text-foreground backdrop:bg-foreground/40"
    >
      <div className="flex flex-col md:flex-row">
        <div className="relative aspect-[4/3] w-full bg-muted md:flex-1">
          <iframe
            ref={frameRef}
            src={demo.src}
            title={`Demo ${name}`}
            sandbox="allow-scripts"
            className="h-full w-full border-0"
          />
        </div>
        <div className="flex w-full flex-col gap-6 p-5 md:w-80">
          <div className="flex items-start justify-between gap-3">
            <h2 id="demo-bench-title" className="text-lg font-semibold tracking-tight">
              {name}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-badge px-3 py-1 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Đóng
            </button>
          </div>
          <KnobControls knobs={demo.knobs} values={values} onChange={handleChange} />
          <Link
            href={`/components/${demo.slug}`}
            className={buttonClasses({ className: 'mt-auto w-full' })}
          >
            Add to bench
          </Link>
        </div>
      </div>
    </dialog>
  )
}
