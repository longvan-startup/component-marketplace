'use client'

import { useEffect, useState } from 'react'
import type { ImageAccordionItem } from '../../components/catalog/image-accordion'
import { ImageAccordion } from '../../components/catalog/image-accordion'
import { DEMO_CHANNEL, DEMO_PROTOCOL_VERSION, parseDemoMessage } from './demo-bridge'

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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 md:p-8">
      <div className="h-[min(560px,calc(100svh-32px))] w-full max-w-5xl">
        <ImageAccordion
          items={items}
          prompt="Di chuột hoặc chọn một ảnh"
          countLabel="ảnh"
          {...values}
        />
      </div>
    </main>
  )
}
