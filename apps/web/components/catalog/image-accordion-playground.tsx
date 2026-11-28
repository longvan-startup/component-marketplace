'use client'

import type { RegistryResponse } from '@marketplace/shared'
import { useState } from 'react'
import type { ImageAccordionItem } from './image-accordion'
import { ImageAccordionCode } from './image-accordion-code'
import { ImageAccordionImagePreview } from './image-accordion-image-preview'
import {
  type AccordionSettings,
  DEFAULT_ACCORDION_SETTINGS,
  ImageAccordionSettings,
} from './image-accordion-settings'

/** Renders the Image Accordion preview, release source, and tuning controls. */
export function ImageAccordionPlayground({
  samples,
  release,
  version,
  sourceMode,
}: {
  samples: readonly ImageAccordionItem[]
  release: RegistryResponse['item'] | null
  version: string
  sourceMode: 'mock' | 'live'
}) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [values, setValues] = useState<AccordionSettings>(DEFAULT_ACCORDION_SETTINGS)

  const update = (key: keyof AccordionSettings, value: number) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <section
      aria-label="Image Accordion playground"
      className="overflow-hidden rounded-card border border-border bg-card"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="min-w-0 bg-zinc-950 p-3 text-zinc-100 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex rounded-full border border-white/10 bg-white/5 p-1"
              role="tablist"
              aria-label="Demo view"
            >
              <button
                id="image-accordion-preview-tab"
                type="button"
                role="tab"
                aria-selected={tab === 'preview'}
                aria-controls="image-accordion-panel"
                onClick={() => setTab('preview')}
                className={`min-h-11 rounded-full px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${tab === 'preview' ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:text-white'}`}
              >
                Preview
              </button>
              <button
                id="image-accordion-code-tab"
                type="button"
                role="tab"
                aria-selected={tab === 'code'}
                aria-controls="image-accordion-panel"
                onClick={() => setTab('code')}
                className={`min-h-11 rounded-full px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${tab === 'code' ? 'bg-white text-zinc-950' : 'text-zinc-300 hover:text-white'}`}
              >
                Code
              </button>
            </div>
          </div>
          <div
            id="image-accordion-panel"
            role="tabpanel"
            aria-labelledby={
              tab === 'preview' ? 'image-accordion-preview-tab' : 'image-accordion-code-tab'
            }
          >
            <div hidden={tab !== 'preview'}>
              <ImageAccordionImagePreview items={samples} {...values} />
            </div>
            {tab === 'code' ? (
              <ImageAccordionCode release={release} liveMode={sourceMode === 'live'} />
            ) : null}
          </div>
        </div>
        <ImageAccordionSettings
          values={values}
          onChange={update}
          onReset={() => setValues(DEFAULT_ACCORDION_SETTINGS)}
          version={version}
          releaseAvailable={release !== null}
          sourceMode={sourceMode}
        />
      </div>
    </section>
  )
}
