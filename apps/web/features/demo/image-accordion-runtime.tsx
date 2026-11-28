'use client'

import { useEffect, useState } from 'react'
import type { ImageAccordionItem } from '../../components/catalog/image-accordion'
import { ImageAccordion } from '../../components/catalog/image-accordion'
import { DEMO_CHANNEL, DEMO_PROTOCOL_VERSION, parseDemoMessage } from './demo-bridge'

const SANDBOX_RUNTIME_STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { width: 100%; min-height: 100%; margin: 0; }
  body { background: #09090b; color: #fafafa; font-family: system-ui, sans-serif; }
  .luva-image-accordion-runtime {
    display: flex; min-height: 100svh; align-items: center; justify-content: center;
    padding: 16px; background: #09090b;
  }
  .luva-image-accordion-runtime__frame {
    width: 100%; height: min(560px, calc(100svh - 32px)); max-width: 80rem;
  }
  .luva-image-accordion {
    display: flex; width: 100%; height: 100%; min-height: 15rem; flex-direction: column;
    gap: 0.75rem; color: inherit;
  }
  .luva-image-accordion__panels { display: flex; min-height: 0; flex: 1; }
  .luva-image-accordion__panel {
    position: relative; display: flex; min-width: 0; flex: 1 1 0%; overflow: hidden;
    padding: 0; border: 0; border-radius: 0.75rem; background: #27272a;
    color: inherit; cursor: pointer; transition: flex-grow 420ms var(--panel-easing);
  }
  .luva-image-accordion__panel:focus-visible {
    z-index: 1; outline: 2px solid #a78bfa; outline-offset: 2px;
  }
  .luva-image-accordion__image {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  }
  .luva-image-accordion__caption {
    display: flex; min-height: 2.5rem; align-items: center; justify-content: space-between;
    gap: 0.75rem; font-size: 0.875rem;
  }
  .luva-image-accordion__label {
    min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .luva-image-accordion__count { flex-shrink: 0; font-variant-numeric: tabular-nums; opacity: 0.8; }
  @media (prefers-reduced-motion: reduce) {
    .luva-image-accordion__panel { transition: none; }
  }
`

/** Runs the gallery inside the catalog demo iframe. */
export function ImageAccordionRuntime({ items }: { items: readonly ImageAccordionItem[] }) {
  const [values, setValues] = useState({ open: 50, reach: 35, bounce: 10, gap: 8 })

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const message = parseDemoMessage(event.data)
      if (message?.type !== 'knobs') return
      setValues((current) => ({
        open: typeof message.values.open === 'number' ? message.values.open : current.open,
        reach: typeof message.values.reach === 'number' ? message.values.reach : current.reach,
        bounce: typeof message.values.bounce === 'number' ? message.values.bounce : current.bounce,
        gap: typeof message.values.gap === 'number' ? message.values.gap : current.gap,
      }))
    }

    window.addEventListener('message', onMessage)
    if (window.parent !== window) {
      window.parent.postMessage(
        { source: DEMO_CHANNEL, version: DEMO_PROTOCOL_VERSION, type: 'ready' },
        '*',
      )
    }
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <>
      <style>{SANDBOX_RUNTIME_STYLES}</style>
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 md:p-8 luva-image-accordion-runtime">
        <div className="h-[min(560px,calc(100svh-32px))] w-full max-w-5xl luva-image-accordion-runtime__frame">
          <ImageAccordion
            items={items}
            prompt="Di chuột hoặc chọn một ảnh"
            countLabel="ảnh"
            {...values}
          />
        </div>
      </main>
    </>
  )
}
