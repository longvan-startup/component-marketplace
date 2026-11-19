'use client'

/**
 * The live demo area at the top of a card. The demo iframe mounts only while
 * the card is near the viewport and a pool slot is free (see demo-pool.ts).
 * Clicking the area opens the bench, which is loaded on first use.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { DemoManifest } from '../../features/demo/demo-manifest'
import { acquireDemoSlot, releaseDemoSlot, subscribeDemoSlots } from './demo-pool'

const DemoBench = lazy(() => import('./demo-bench').then((m) => ({ default: m.DemoBench })))

export function DemoPreview({
  demo,
  name,
  summary,
}: {
  demo: DemoManifest | null
  name: string
  summary?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slot] = useState(() => Symbol('demo-slot'))
  const [inView, setInView] = useState(false)
  const [live, setLive] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)

  /* The bench unmounts as soon as it closes, so focus goes back to the card's
     opener by hand. */
  const closeBench = () => {
    setOpen(false)
    requestAnimationFrame(() => openerRef.current?.focus())
  }

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const element = containerRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { rootMargin: '200px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!demo || !inView || reducedMotion) {
      setLive(false)
      return
    }
    /* Take a slot now, or wait for one to be freed by another card. */
    let unsubscribe = () => {}
    const tryAcquire = () => {
      if (!acquireDemoSlot(slot)) return false
      unsubscribe()
      setLive(true)
      return true
    }
    if (!tryAcquire()) unsubscribe = subscribeDemoSlots(() => void tryAcquire())
    return () => {
      unsubscribe()
      releaseDemoSlot(slot)
      setLive(false)
    }
  }, [demo, inView, reducedMotion, slot])

  if (!demo) {
    return (
      <div className="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground">
        Chưa có demo
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-40 overflow-hidden bg-muted">
      {live ? (
        <iframe
          src={demo.src}
          title={`Demo ${name}`}
          sandbox="allow-scripts"
          tabIndex={-1}
          className="h-full w-full border-0"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {reducedMotion ? 'Demo tạm dừng theo cài đặt giảm chuyển động' : 'Chạm để xem demo'}
        </span>
      )}
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Mở demo ${name}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      {open ? (
        <Suspense fallback={null}>
          <DemoBench
            demo={demo}
            name={name}
            summary={summary}
            originRef={openerRef}
            onClose={closeBench}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
